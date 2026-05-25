import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AuthService } from '../services/auth.service';

function passwordsMatchValidator(
  group: AbstractControl,
): ValidationErrors | null {
  const newPwd = group.get('new_password')?.value;
  const confirm = group.get('confirm_password')?.value;
  if (!newPwd || !confirm) return null;
  return newPwd === confirm ? null : { passwordsMismatch: true };
}

@Component({
  selector: 'app-reset-password',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './reset-password.html',
  styleUrl: './reset-password.css',
})
export class ResetPassword implements OnInit {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  loading = signal(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);
  showNew = signal(false);
  showConfirm = signal(false);
  token = signal<string | null>(null);

  form = this.fb.nonNullable.group(
    {
      new_password: [
        '',
        [
          Validators.required,
          Validators.minLength(6),
          Validators.maxLength(128),
        ],
      ],
      confirm_password: ['', [Validators.required]],
    },
    { validators: passwordsMatchValidator },
  );

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');
    this.token.set(token);
    if (!token) {
      this.errorMessage.set(
        'No reset token found. Please request a new reset link.',
      );
    }
  }

  onSubmit(): void {
    const token = this.token();
    if (!token) {
      this.errorMessage.set(
        'Missing reset token. Please request a new reset link.',
      );
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    this.auth
      .confirmPasswordReset({
        token,
        new_password: this.form.controls.new_password.value,
      })
      .subscribe({
        next: (res) => {
          this.successMessage.set(res.message + ' Redirecting to login...');
          setTimeout(() => this.router.navigate(['/login']), 1800);
        },
        error: (err: HttpErrorResponse) => {
          this.loading.set(false);
          this.errorMessage.set(
            err.error?.detail ??
              'Failed to reset password. The link may be invalid or expired.',
          );
        },
      });
  }
}

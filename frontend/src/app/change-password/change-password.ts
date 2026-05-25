import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

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
  selector: 'app-change-password',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './change-password.html',
  styleUrl: './change-password.css',
})
export class ChangePassword {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);

  loading = signal(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);
  showCurrent = signal(false);
  showNew = signal(false);
  showConfirm = signal(false);

  form = this.fb.nonNullable.group(
    {
      current_password: ['', [Validators.required]],
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

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    const { current_password, new_password } = this.form.getRawValue();
    this.auth.changePassword({ current_password, new_password }).subscribe({
      next: () => {
        this.successMessage.set('Password updated! Redirecting...');
        setTimeout(() => this.router.navigate(['/dashboard']), 1500);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.errorMessage.set(
          err.error?.detail ?? 'Failed to change password. Please try again.',
        );
      },
    });
  }
}

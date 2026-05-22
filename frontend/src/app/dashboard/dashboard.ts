import { Component, inject } from '@angular/core';

import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-dashboard',
  imports: [],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard {
  private auth = inject(AuthService);

  email = this.auth.getUserEmail();

  logout(): void {
    this.auth.logout();
  }
}

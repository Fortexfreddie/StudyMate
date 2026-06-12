export function validateEmail(email: string): string | undefined {
  if (!email.trim()) {
    return "Email address is required";
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return "Please enter a valid email address";
  }
  return undefined;
}

export function validatePassword(password: string): string | undefined {
  if (!password) {
    return "Password is required";
  }
  if (password.length < 8) {
    return "Password must be at least 8 characters long";
  }
  return undefined;
}

export function validateFullName(name: string): string | undefined {
  if (!name.trim()) {
    return "Full name is required";
  }
  return undefined;
}

export function validateConfirmPassword(password: string, confirm: string): string | undefined {
  if (!confirm) {
    return "Confirm password is required";
  }
  if (confirm !== password) {
    return "Passwords do not match";
  }
  return undefined;
}

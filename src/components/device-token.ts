const key = "smashkaki_device_token";

export function deviceToken(): string {
  let token = localStorage.getItem(key);

  if (!token) {
    token = crypto.randomUUID();
    localStorage.setItem(key, token);
  }

  return token;
}

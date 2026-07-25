'use strict';

class EcoNetClient {

  constructor() {
    this.baseUrl = 'https://www.econet24.com';
    this.cookies = new Map();
  }

  _saveCookies(response) {
    const setCookies = typeof response.headers.getSetCookie === 'function'
      ? response.headers.getSetCookie()
      : [];

    for (const cookieString of setCookies) {
      const firstPart = cookieString.split(';', 1)[0];
      const separator = firstPart.indexOf('=');

      if (separator <= 0) {
        continue;
      }

      const name = firstPart.slice(0, separator).trim();
      const value = firstPart.slice(separator + 1).trim();

      this.cookies.set(name, value);
    }
  }

  _cookieHeader() {
    return [...this.cookies.entries()]
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');
  }

  async _request(path, options = {}) {
    const headers = {
      Accept: 'application/json, text/html;q=0.9, */*;q=0.8',
      ...options.headers,
    };

    const cookies = this._cookieHeader();

    if (cookies) {
      headers.Cookie = cookies;
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers,
      redirect: options.redirect ?? 'manual',
    });

    this._saveCookies(response);

    return response;
  }

  _extractCsrfToken(html) {
    const patterns = [
      /name=["']csrfmiddlewaretoken["'][^>]*value=["']([^"']+)["']/i,
      /value=["']([^"']+)["'][^>]*name=["']csrfmiddlewaretoken["']/i,
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);

      if (match) {
        return match[1];
      }
    }

    return this.cookies.get('csrftoken') || null;
  }

  async login(username, password) {
    if (!username || !password) {
      throw new Error('Användarnamn och lösenord måste fyllas i.');
    }

    const loginPage = await this._request('/', {
      method: 'GET',
    });

    if (!loginPage.ok) {
      throw new Error(
        `Kunde inte öppna ecoNET24:s inloggningssida (${loginPage.status}).`
      );
    }

    const loginHtml = await loginPage.text();
    const csrfToken = this._extractCsrfToken(loginHtml);

    if (!csrfToken) {
      throw new Error('Kunde inte läsa CSRF-token från ecoNET24.');
    }

    const form = new URLSearchParams({
      csrfmiddlewaretoken: csrfToken,
      username,
      password,
    });

    const response = await this._request('/login/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Origin: this.baseUrl,
        Referer: `${this.baseUrl}/`,
        'X-CSRFToken': csrfToken,
      },
      body: form.toString(),
      redirect: 'manual',
    });

    const location = response.headers.get('location') || '';

    if (response.status !== 302 || !location.startsWith('/process')) {
      throw new Error('Fel användarnamn eller lösenord till ecoNET24.');
    }

    const processResponse = await this._request('/process/', {
      method: 'GET',
      headers: {
        Referer: `${this.baseUrl}/`,
      },
      redirect: 'manual',
    });

    const processLocation =
      processResponse.headers.get('location') || '';

    if (
      processResponse.status !== 302
      || !processLocation.startsWith('/main')
    ) {
      throw new Error('ecoNET24 kunde inte slutföra inloggningen.');
    }

    return true;
  }

  async getDevice(uid) {
    if (!uid) {
      throw new Error('Device UID måste fyllas i.');
    }

    const path =
      `/aweb/d/dev/v2/legacy/device?uid=${encodeURIComponent(uid)}`;

    const response = await this._request(path, {
      method: 'GET',
      headers: {
        Referer: `${this.baseUrl}/main/`,
      },
    });

    if (response.status === 301 || response.status === 302) {
      throw new Error('Sessionen mot ecoNET24 är inte giltig.');
    }

    if (!response.ok) {
      throw new Error(
        `ecoNET24 kunde inte läsa enheten (${response.status}).`
      );
    }

    const contentType = response.headers.get('content-type') || '';

    if (!contentType.includes('application/json')) {
      throw new Error('ecoNET24 returnerade ett oväntat svar.');
    }

    const result = await response.json();

    if (!Array.isArray(result.device) || result.device.length === 0) {
      throw new Error(
        'Ingen ecoMAX-enhet hittades med angivet Device UID.'
      );
    }

    return result.device;
  }

  async getDeviceParams(uid) {
    if (!uid) {
      throw new Error('Device UID saknas.');
    }

    const path =
      `/service/getDeviceParams?uid=${encodeURIComponent(uid)}`;

    const response = await this._request(path, {
      method: 'GET',
      headers: {
        Referer: `${this.baseUrl}/main/`,
      },
    });

    if (response.status === 301 || response.status === 302) {
      throw new Error('Sessionen mot ecoNET24 har gått ut.');
    }

    if (!response.ok) {
      throw new Error(
        `Kunde inte hämta ecoMAX-data (${response.status}).`
      );
    }

    const contentType = response.headers.get('content-type') || '';

    if (!contentType.includes('application/json')) {
      throw new Error('ecoNET24 returnerade inte JSON-data.');
    }

    const result = await response.json();

    if (!result || !result.curr) {
      throw new Error(
        'Aktuella värden saknas i svaret från ecoNET24.'
      );
    }

    return result;
  }

  async getDeviceRegParams(uid) {
    if (!uid) {
      throw new Error('Device UID saknas.');
    }

    const path =
      `/service/getDeviceRegParams?uid=${encodeURIComponent(uid)}`;

    const response = await this._request(path, {
      method: 'GET',
      headers: {
        Referer: `${this.baseUrl}/main/`,
      },
    });

    if (response.status === 301 || response.status === 302) {
      throw new Error('Sessionen mot ecoNET24 har gått ut.');
    }

    if (!response.ok) {
      throw new Error(
        `Kunde inte hämta registerdata (${response.status}).`
      );
    }

    const contentType = response.headers.get('content-type') || '';

    if (!contentType.includes('application/json')) {
      throw new Error(
        'ecoNET24 returnerade inte registerdata som JSON.'
      );
    }

    const result = await response.json();

    if (!result || typeof result.data !== 'object') {
      throw new Error(
        'Registerdata saknas i svaret från ecoNET24.'
      );
    }

    return result.data;
  }

}

module.exports = EcoNetClient;
import { ErrorApi } from './errores';
import { obtenerToken, olvidarSesion } from '@/composables/useAuth';
import router from '@/router';

const BASE_URL = import.meta.env.VITE_API_URL;
const TIEMPO_MAXIMO_MS = 10_000;

export interface OpcionesApi {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  params?: Record<string, string | number | undefined>;
}

export async function api<T = unknown>(ruta: string, opciones: OpcionesApi = {}): Promise<T> {
  let url = `${BASE_URL}${ruta}`;
  if (opciones.params) {
    const qs = new URLSearchParams();
    for (const [clave, valor] of Object.entries(opciones.params)) {
      if (valor !== undefined && valor !== '') {
        qs.append(clave, String(valor));
      }
    }
    const cadenaQs = qs.toString();
    if (cadenaQs) {
      url += `?${cadenaQs}`;
    }
  }

  const token = obtenerToken();
  const tieneBody = opciones.body !== undefined;
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(tieneBody ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), TIEMPO_MAXIMO_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      method: opciones.method ?? 'GET',
      headers,
      body: tieneBody ? JSON.stringify(opciones.body) : undefined,
      signal: controlador.signal,
    });
  } catch {
    throw new ErrorApi(0, { mensaje: 'No fue posible conectar con la API.' });
  } finally {
    clearTimeout(temporizador);
  }

  if (response.status === 204) {
    return null as T;
  }

  const cuerpoJson = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 401 && ruta !== '/login') {
      await olvidarSesion();
      await router.replace('/login');
    }
    throw new ErrorApi(response.status, cuerpoJson);
  }

  return cuerpoJson as T;
}
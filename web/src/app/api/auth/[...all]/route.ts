import { getAuth } from "@/server/auth";

// L'instance est créée à la première requête : `next build` n'a pas besoin des secrets.
export async function GET(request: Request) {
  return getAuth().handler(request);
}

export async function POST(request: Request) {
  return getAuth().handler(request);
}

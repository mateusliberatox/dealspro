import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const origin   = new URL(request.url).origin;

  const response = NextResponse.redirect(`${origin}/`);

  // Salva o código de indicação em cookie por 30 dias
  response.cookies.set('dp_ref', code, {
    maxAge:   30 * 24 * 60 * 60,
    path:     '/',
    sameSite: 'lax',
    httpOnly: false, // lido no client para mostrar mensagem de boas-vindas
  });

  return response;
}

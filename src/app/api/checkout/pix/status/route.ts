import { NextRequest, NextResponse } from 'next/server'
import { MercadoPagoConfig, Payment } from 'mercadopago'

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN!,
})

type StatusNormalizado = 'pending' | 'approved' | 'rejected'

function normalizarStatus(status: string | undefined | null): StatusNormalizado {
  if (status === 'approved') return 'approved'
  if (status === 'rejected' || status === 'cancelled' || status === 'refunded' || status === 'charged_back') return 'rejected'
  return 'pending'
}

export async function GET(request: NextRequest) {
  const paymentId = request.nextUrl.searchParams.get('paymentId')

  if (!paymentId) {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'paymentId obrigatório' } },
      { status: 400 }
    )
  }

  try {
    const payment = new Payment(client)
    const result = await payment.get({ id: paymentId })

    return NextResponse.json({
      success: true,
      data: { status: normalizarStatus(result.status) },
    })
  } catch (error) {
    console.error(JSON.stringify({
      event: 'checkout.pix.status.error',
      paymentId,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      timestamp: new Date().toISOString(),
    }))

    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Erro ao consultar status do pagamento' } },
      { status: 500 }
    )
  }
}

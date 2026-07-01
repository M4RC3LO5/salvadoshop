import { NextRequest, NextResponse } from 'next/server'
import { MercadoPagoConfig, Payment } from 'mercadopago'

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN!,
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { orderId, amount, payerEmail, payerCpf, payerName } = body

    if (!orderId || !amount || !payerEmail || !payerCpf || !payerName) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Campos obrigatórios ausentes' } },
        { status: 400 }
      )
    }

    const expirationDate = new Date(Date.now() + 30 * 60 * 1000).toISOString()

    const payment = new Payment(client)
    const result = await payment.create({
      body: {
        transaction_amount: amount,
        description: `Pedido ${orderId} — SalvadoShop`,
        payment_method_id: 'pix',
        date_of_expiration: expirationDate,
        payer: {
          email: payerEmail,
          first_name: payerName.split(' ')[0],
          last_name: payerName.split(' ').slice(1).join(' ') || payerName.split(' ')[0],
          identification: {
            type: 'CPF',
            number: payerCpf.replace(/\D/g, ''),
          },
        },
        external_reference: orderId,
      },
    })

    const pixData = result.point_of_interaction?.transaction_data

    if (!pixData?.qr_code || !pixData?.qr_code_base64) {
      return NextResponse.json(
        { success: false, error: { code: 'PAYMENT_FAILED', message: 'Falha ao gerar QR Code Pix' } },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        pixCode: pixData.qr_code,
        pixQrCodeBase64: pixData.qr_code_base64,
        paymentId: String(result.id),
      },
    })
  } catch (error) {
    console.error(JSON.stringify({
      event: 'checkout.pix.error',
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      timestamp: new Date().toISOString(),
    }))

    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Erro ao processar pagamento Pix' } },
      { status: 500 }
    )
  }
}

// Redimensiona a imagem no navegador e converte para JPEG (resolve HEIC do
// iPhone e reduz o upload). Lado maior <= 1600px, qualidade 0.85.
// Cópia da lógica da triagem/capturar — mantida separada de propósito.

const LADO_MAXIMO = 1600
const QUALIDADE_JPEG = 0.85

export function redimensionarImagem(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader()

    leitor.onload = () => {
      const img = new Image()

      img.onload = () => {
        const ladoMaior = Math.max(img.width, img.height)
        const escala = ladoMaior > LADO_MAXIMO ? LADO_MAXIMO / ladoMaior : 1
        const largura = Math.round(img.width * escala)
        const altura = Math.round(img.height * escala)

        const canvas = document.createElement("canvas")
        canvas.width = largura
        canvas.height = altura

        const ctx = canvas.getContext("2d")
        if (!ctx) {
          reject(new Error("Não foi possível processar a imagem."))
          return
        }

        ctx.drawImage(img, 0, 0, largura, altura)

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Não foi possível converter a imagem."))
              return
            }
            resolve(new File([blob], "foto.jpg", { type: "image/jpeg" }))
          },
          "image/jpeg",
          QUALIDADE_JPEG
        )
      }

      img.onerror = () => reject(new Error("Não foi possível abrir a imagem."))
      img.src = leitor.result as string
    }

    leitor.onerror = () => reject(new Error("Não foi possível ler o arquivo."))
    leitor.readAsDataURL(file)
  })
}

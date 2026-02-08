function calcularPerdaGPON(
  comprimentoMetros: number,
  {
    emendas = 0,
    conectores = 0,
    splitterDb = 0 // 1:32 padrão
  } = {}
) {
  const km = comprimentoMetros / 1000

  const perdaFibra = km * 0.25
  const perdaEmendas = emendas * 0.1
  const perdaConectores = conectores * 0.2

  const perdaTotal =
    perdaFibra + perdaEmendas + perdaConectores + splitterDb

  return {
    perdaFibra,
    perdaEmendas,
    perdaConectores,
    splitterDb,
    perdaTotal
  }
}
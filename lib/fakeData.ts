// lib/fakeData.ts
export const clients = [
  {
    id: 1,
    nome: "Cliente A",
    position: { lat: -23.55052, lng: -46.633308 },
    rx: -26
  },
  {
    id: 2,
    nome: "Cliente B",
    position: { lat: -23.551, lng: -46.632 },
    rx: -24
  }
]

export const fibers = [
  {
    id: 1,
    nome:"Fibra 1",
    descricao: "Fibra óptica que conecta o cliente A ao ponto de distribuição",
    color: "black",
    path: [
      { lat: -23.55052, lng: -46.633308 },
      { lat: -23.551, lng: -46.632 },
      
      
    ]
  }
]
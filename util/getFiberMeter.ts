function calcularComprimento(path: { lat: number; lng: number }[]) {
  let total = 0

  for (let i = 1; i < path.length; i++) {
    const p1 = new google.maps.LatLng(path[i - 1])
    const p2 = new google.maps.LatLng(path[i])
    total += google.maps.geometry.spherical.computeDistanceBetween(p1, p2)
  }

  return total // metros
}
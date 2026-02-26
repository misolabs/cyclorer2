function element(id: string){
    return document.getElementById(id)
}

function setTextContent(id: string, text: string){
    let el = element(id)
    if(el)
        el.textContent = text
}

export function formatDistance(d: number): string{
    const suffix = d > 1000 ? "km" : "m"
    const value = d > 1000 ? (d / 1000).toFixed(1) : d.toFixed(0)
    return value + suffix
}

export function setDescription(text: string){
    setTextContent("description", text)
}
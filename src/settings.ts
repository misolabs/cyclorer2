export interface Settings{
    showDeadends: boolean
}

let settingsPane: HTMLElement
let deadendsInput: HTMLInputElement

let listener: ((s: Settings) => void) | null

export function settingsInit(element: string, l: ((s: Settings) => void) | null) {
    settingsPane = document.getElementById(element)!
    listener = l

    document.getElementById("settings-close")?.addEventListener("click", settingsCloseListener)
    deadendsInput = document.getElementById("settings-deadends")! as HTMLInputElement
}

export function settingsShow(){
    settingsPane.style.visibility = "visible"
}

function settingsCloseListener(event:MouseEvent){
    settingsPane.style.visibility = "hidden"

    const settings: Settings={
        showDeadends: deadendsInput.checked,
    }

    if(listener)
        listener(settings)
}

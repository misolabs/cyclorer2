import type {EventBus} from "../eventbus.ts";
import {NotificationType, type NotificationData} from "../models/models.ts";

const notificationTheme: Record<NotificationType, { icon: string; accent: string }> = {
  ERROR: { icon: "error", accent: "#d32f2f" },
  WARNING: { icon: "warning", accent: "#ed6c02" },
  SUCCESS: { icon: "check_circle", accent: "#2e7d32" },
  INFO: { icon: "info", accent: "#1976d2" },
}

export class NotificationsView {
  bus: EventBus
  root: HTMLElement
  autoCloseTimers = new Map<HTMLElement, number>()

  constructor(bus: EventBus) {
    this.bus = bus
    this.root = document.getElementById("notifications-view")!

    this.bus.on("notification:show", this.showNotification.bind(this))
  }

  showNotification(notification: NotificationData) {
    const theme = notificationTheme[notification.type] ?? notificationTheme.INFO
    const card = document.createElement("button")
    card.type = "button"
    card.className = "notification-card"
    card.dataset.type = notification.type
    card.style.setProperty("--notification-accent", theme.accent)
    card.setAttribute("aria-label", `${notification.type}: ${notification.caption}`)

    const icon = document.createElement("span")
    icon.className = "material-symbols-rounded notification-card__icon"
    icon.textContent = theme.icon

    const content = document.createElement("div")
    content.className = "notification-card__content"

    const caption = document.createElement("div")
    caption.className = "notification-card__caption roboto-font"
    caption.textContent = notification.caption

    const description = document.createElement("div")
    description.className = "notification-card__description"
    description.textContent = notification.description

    content.append(caption, description)
    card.append(icon, content)

    card.addEventListener("click", () => this.dismissNotification(card))

    this.root.append(card)
    requestAnimationFrame(() => {
      card.classList.add("notification-card--visible")
    })

    if (typeof notification.autocloseDelay === "number") {
      const timer = window.setTimeout(() => this.dismissNotification(card), notification.autocloseDelay)
      this.autoCloseTimers.set(card, timer)
    }
  }

  dismissNotification(card: HTMLElement) {
    const timer = this.autoCloseTimers.get(card)
    if (typeof timer === "number") {
      window.clearTimeout(timer)
      this.autoCloseTimers.delete(card)
    }

    if (!card.isConnected) return

    card.classList.remove("notification-card--visible")
    card.classList.add("notification-card--closing")

    const removeCard = () => {
      this.autoCloseTimers.delete(card)
      card.remove()
    }

    card.addEventListener("transitionend", removeCard, { once: true })
    window.setTimeout(removeCard, 250)
  }
}

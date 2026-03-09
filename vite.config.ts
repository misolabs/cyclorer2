import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa"

// For github CI
export default defineConfig({
    base: "/cyclorer2/",
    plugins: [
        VitePWA({
            registerType: "autoUpdate",

            manifest: {
                name: "Cyclorer",
                short_name: "Cyclorer",
                description: "Cycling navigation and exploration",

                theme_color: "#1e88e5",
                background_color: "#ffffff",
                display: "standalone",

                start_url: "/",
                scope: "/",

                icons: [
                    {
                        src: "icon-128.png",
                        sizes: "128x128",
                        type: "image/png"
                    },
                    {
                        src: "icon-512.png",
                        sizes: "512x512",
                        type: "image/png"
                    },
                ]
            }
        })
    ]
});

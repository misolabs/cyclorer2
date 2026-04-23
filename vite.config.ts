import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa"

// For github CI
export default defineConfig({
    server:{
        allowedHosts:['macbook'],
    },
    base: "/cyclorer2/",
    plugins: [
        VitePWA({
            strategies: "injectManifest",
            srcDir: 'src',
            filename: 'sw.ts',
            workbox: {
                globPatterns: [
                    '**/*.{js,css,html,ico,png,jpg,svg,woff2}'
                ],
            },

            manifest: {
                name: "Cyclorer 2",
                short_name: "Cyclorer2",
                description: "Cycling navigation and exploration",

                theme_color: "#1e88e5",
                background_color: "#ffffff",
                display: "standalone",

                start_url: "/cyclorer2/",
                scope: "/cyclorer2/",

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

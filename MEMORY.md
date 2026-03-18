# Memory

## Proje Bilgileri
- Proje adı: **AWS Manager** (aws-optimizer monorepo)
- Proje artık **UI-first** — CLI kısımları hâlâ mevcut ama geliştirme UI odaklı
- Repo: git@github.com:ozanturksever/cloutive-cli.git
- Monorepo yapısı: apps/web (React 19 + Mantine v8), apps/sandbox (Cloudflare Workers+Containers), packages/convex (Convex backend)
- Auth: Better Auth + Convex (org plugin ile multi-tenancy)
- AI Agent: @convex-dev/agent + OpenRouter (Claude Sonnet 4), 5 AWS tool + 4 analysis tool
- Billing: Stripe (Free/Starter/Pro/Enterprise)
- Deploy: Cloudflare Pages (web) + Cloudflare Workers (sandbox) + Convex (backend)

## URLs
- **Repo:** https://github.com/ozanturksever/cloutive-cli
- **Staging Web:** https://aws-optimizer-web-staging.ozan-turksever.workers.dev

## Ekip
- w1 (fatagnus / Serkan) — ekip üyesi, Cloutive - AI grubunda aktif
- Ozan — proje sahibi

## Rol
- Asistan aktif geliştirici rolünde: kod yazar, özellik ekler, bug fixler, refactor yapar
- Değişiklikler sadece memory'de değil, doğrudan codebase'de de yapılmalı
- Deploy öncesi HER ZAMAN: git pull → conflict varsa merge → sonra deploy

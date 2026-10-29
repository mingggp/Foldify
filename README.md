# 📦 Foldify

An interactive web-based 3D box builder application designed for the "Computer Engineering Essential Final Project". Foldify allows users to fold 2D nets into 3D boxes, apply custom textures (including AI-generated textures), utilize Computer Vision to scan nets from photos, and save their creations.

## ✨ Features (Mapped to Project Criteria)

### 1. Basic Requirements
*   🔐 **User Authentication:** Secure login, logout, and registration using Firebase Auth. Personal user sessions ensure that creations are tied to individual accounts.
*   🌐 **External API Integration:**
    *   **Hugging Face Inference API:** Powers the AI Texture Generator, allowing users to type a prompt and instantly generate custom seamless textures for their 3D boxes using the `FLUX.1-schnell` model.
*   🚀 **Deployment:** (Provide your Vercel/Firebase Hosted link here!)

### 2. Challenging Requirements
*   🧠 **Tier S - Computer Vision (Smart Scan Net):** Users can upload an image of any valid 2D cube net. The application's custom client-side image processing algorithm scans the image, extracts the topology, and instantly converts it into an interactive 3D model.
*   💾 **Tier B - Saved / Favorites (Gallery System):** Users can save their uniquely customized 3D boxes (with specific textures, shapes, and colors) to a personal Gallery powered by Firebase Firestore. Full CRUD functionality is implemented (Save, Read, Load, Delete).
*   🎨 **Tier C - Theme Toggle:** Full Dark Mode and Light Mode support seamlessly integrated with Tailwind CSS.
*   🔔 **Tier C - Notifications:** Comprehensive Toast Notification system providing instant feedback on user actions (e.g., successful exports, AI generation errors).

### 3. Additional UI/UX Features
*   **Advanced Export Studio:** Export the 3D canvas as a high-quality PNG with a custom transparent background, built-in zooming, panning, and clipboard copy support.
*   **3D Interactive Canvas:** Smooth camera trackball controls, real-time folding animations, and localized texture mapping using `react-three-fiber`.

---

## 🛠️ Technologies Used

*   **Frontend Framework:** React + Vite
*   **3D Rendering:** Three.js, React Three Fiber, React Three Drei
*   **Styling:** Tailwind CSS v4, Lucide React (Icons)
*   **Backend & Auth:** Firebase (Authentication, Firestore)
*   **AI Integration:** Hugging Face Inference API

---

## 🚀 How to Run Locally

1. **Clone the repository:**
   ```bash
   git clone <your-repo-url>
   cd box-edu-3d
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up Environment Variables:**
   * Copy `.env.example` to `.env.local`
   * Fill in your Firebase configuration details from the Firebase Console (`VITE_FIREBASE_*`).
   * Add your Hugging Face token as **`HF_TOKEN`** (server-only — no `VITE_` prefix, so it is never put in the browser bundle). On Vercel set it under *Settings → Environment Variables*.

4. **Start the Development Server:**
   ```bash
   npm run dev
   ```
   The application will be available at `http://localhost:5173`. The AI endpoint `/api/generate-image` also runs locally.

## 🔌 AI image endpoint

`POST /api/generate-image` with `{ "prompt": "..." }` returns the generated image. It is a Vercel Function (`api/generate-image.js`) that keeps the Hugging Face token on the server and is open to everyone with rate limits:

| Env var | Default | Meaning |
|---|---|---|
| `AI_LIMIT_PER_MINUTE` | 4 | requests per IP per minute |
| `AI_LIMIT_PER_DAY` | 30 | requests per IP per day |
| `AI_LIMIT_GLOBAL_DAY` | 500 | whole site per day (protects the HF quota) |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | – | optional shared counter store; without it limits are per server instance |

## 🧪 Tests

```bash
npx playwright install chromium   # first time only
npm run test:quick                # unit + 3D orientation tests (~3 min)
npm test                          # everything, incl. exhaustive Smart Scan matrix
```

Tests start their own dev server with fake Firebase settings, so no real project is needed.

* `tests/unit` — net geometry (all 11 nets × 8 placements fold into a cube, face names match, no duplicate shapes) and the AI endpoint (token stays server-side, validation, rate limits).
* `tests/e2e/orientation.spec.js` — puts a letter + coloured corners on every face and checks each face, flat and folded, is upright and **not mirrored**.
* `tests/e2e/smartScan.spec.js` — draws synthetic net photos, rotates them 0/90/180/270°, scans them and checks the 3D box equals folding the paper by hand.

### How the 3D net works (`src/lib/netGeometry.js`)

* Paper → world: paper-right = +X, paper-up = −Z, printed side faces +Y. Faces fold *down* so the print ends up outside, and only the front (printed) side of each square shows the picture; the back shows plain paper.
* A net is placed on paper by `{ rotation, flipX, flipY }`. Placements move squares, never mirror the pictures on them.
* Face names (`top`, `front`, …) are computed from where each square really folds, so labels and the sidebar are always right.

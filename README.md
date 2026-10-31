# 📦 Foldify

An interactive web-based 3D box builder application designed for the "Computer Engineering Essential Final Project". Foldify allows users to fold 2D nets into 3D boxes, apply custom textures, utilize Computer Vision to scan nets from photos, and save their creations.

## ✨ Features (Mapped to Project Criteria)

### 1. Basic Requirements
*   🔐 **User Authentication:** Secure login, logout, and registration using Firebase Auth. Personal user sessions ensure that creations are tied to individual accounts.
*   🌐 **External services:** Firebase Authentication and Cloud Firestore. (The Hugging Face AI Texture Generator was removed — it was rarely used and needed a server-side secret.)
*   🚀 **Deployment:** (Provide your Vercel/Firebase Hosted link here!)

### 2. Challenging Requirements
*   🧠 **Tier S - Computer Vision (Smart Scan Net):** Users can upload an image of any valid 2D cube net. The application's custom client-side image processing algorithm scans the image, extracts the topology, and instantly converts it into an interactive 3D model.
*   💾 **Tier B - Saved / Favorites (Gallery System):** Users can save their uniquely customized 3D boxes (with specific textures, shapes, and colors) to a personal Gallery powered by Firebase Firestore. Full CRUD functionality is implemented (Save, Read, Load, Delete).
*   🎨 **Tier C - Theme Toggle:** Full Dark Mode and Light Mode support seamlessly integrated with Tailwind CSS.
*   🔔 **Tier C - Notifications:** Comprehensive Toast Notification system providing instant feedback on user actions (e.g., successful exports, scan errors).

### 3. Additional UI/UX Features
*   **Advanced Export Studio:** Export the 3D canvas as a high-quality PNG with a custom transparent background, built-in zooming, panning, and clipboard copy support.
*   **3D Interactive Canvas:** Smooth camera trackball controls, real-time folding animations, and localized texture mapping using `react-three-fiber`.

---

## 🛠️ Technologies Used

*   **Frontend Framework:** React + Vite
*   **3D Rendering:** Three.js, React Three Fiber, React Three Drei
*   **Styling:** Tailwind CSS v4, Lucide React (Icons)
*   **Backend & Auth:** Firebase (Authentication, Firestore)

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

4. **Start the Development Server:**
   ```bash
   npm run dev
   ```
   The application will be available at `http://localhost:5173`.

## 🧪 Tests

```bash
npx playwright install chromium   # first time only
npm run test:quick                # unit + 3D orientation tests (~3 min)
npm test                          # everything, incl. exhaustive Smart Scan matrix
```

Tests start their own dev server with fake Firebase settings, so no real project is needed.

```bash
npm run test:rules                # Firestore Security Rules on the local emulator (needs Java 21)
```

GitHub Actions (`.github/workflows/test.yml`) runs the rules tests and `test:quick` on every pull request.

* `tests/unit` — net geometry (all 11 nets × 8 placements fold into a cube, face names match, no duplicate shapes).
* `tests/rules/firestore.spec.js` — who can create / read / update / delete boxes, and what saved data must look like.
* `tests/e2e/orientation.spec.js` — puts a letter + coloured corners on every face and checks each face, flat and folded, is upright and **not mirrored**.
* `tests/e2e/smartScan.spec.js` — draws synthetic net photos, rotates them 0/90/180/270°, scans them and checks the 3D box equals folding the paper by hand.

### How the 3D net works (`src/lib/netGeometry.js`)

* Paper → world: paper-right = +X, paper-up = −Z, printed side faces +Y. Faces fold *down* so the print ends up outside, and only the front (printed) side of each square shows the picture; the back shows plain paper.
* A net is placed on paper by `{ rotation, flipX, flipY }`. Placements move squares, never mirror the pictures on them.
* Face names (`top`, `front`, …) are computed from where each square really folds, so labels and the sidebar are always right.

## 🔒 Firestore rules

`firestore.rules` is the source of truth — deploy with `npx firebase-tools deploy --only firestore:rules` (or paste it into Console → Firestore → Rules).

* Only signed-in users can save, and only under their own `userId`; `createdAt` must be the server time.
* Saved data is validated (known fields only, 6 faces, net 0–10, rotation 0–3, pictures ≤ 120 KB each).
* Boxes are private by default; the owner can set `visibility: "public"` so anyone can open it by id (for share links / a public gallery). Boxes saved before this change count as private.
* After saving, the owner can only rename or change visibility. Everything outside `boxes` is closed.

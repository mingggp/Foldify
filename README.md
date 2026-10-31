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

## 🔗 Worksheet links, QR codes & guess mode

The **Share / QR** button builds a link (and a downloadable QR code) for the net on screen — type a label on each square, optionally turn labels, choose whether it opens folded or in guess mode. Teachers never need to write the format by hand.

```
?v=1&net=3&labels=ABCDEF&turn=000100&rot=0&flip=0&fold=0&quiz=1
?v=1&box=<id>        (a box saved in the Gallery and shared as public)
```

`labels` go on the squares in reading order (left→right, top→bottom) of the net as shown; Thai works (`labels=กขคงจฉ`), use commas for longer labels. Full description in `src/lib/shareLink.js`. Every link carries `v=` so printed QR codes keep working if the format changes later.

**Guess before folding** makes an exam-style question from the box on screen (`src/lib/cubeQuiz.js`, `components/quiz/QuizModal.jsx`):
- *Net → box*: the net is the question, the 5 choices are folded boxes (three faces seen, isometric).
- *Box → net*: the box seen from two sides is the question, the 5 choices are nets (five different net shapes).
- Ask for *the right one* (1 right, 4 wrong) or *the odd one out* (4 right, 1 wrong), or mix.
- Wrong choices are made by turning a face, swapping two faces, or putting two opposite faces side by side — and are only used if they really *look* different from every correct view (faces are compared by small pixel signatures, so plain colours or symmetric pictures can't make a "wrong" answer that is actually right). If the box's faces are too alike, a lettered practice net is used instead.
- Tests compare the 2D quiz pictures with the real 3D box (`tests/e2e/cubeQuiz.spec.js`).

## 🎨 Look and feel

- Design tokens (colours, fonts, glass panels) live at the top of `src/index.css`. Brand teals: `#28a1ab`, `#00c8b5`, `#00d5c9`; amber `#ffb238` marks the selected face.
- Fonts are bundled from npm (Anuphan for text, Bai Jamjuree for headings) — no font CDN, so it still works on school networks that block them.
- Light / dark / auto theme in Settings (remembered per browser). Tools panel docks beside the 3D view from 1024 px wide (iPad landscape, PC) and slides in from the side on narrower screens.
- The previous interface is kept on the `legacy/ui-v1` branch.
- Logo ideas: `design/logo-proposals/board.png`.
- **Save a picture** (download button): the preview is exactly the exported PNG (2048 px), with view (isometric / as on screen), shape, zoom, white or transparent background, floor grid and shadow options. Selection outlines are never included.
- Right-click menus are switched off (except in text fields).

## ✏️ Shape editor

Decorate tab → "Open the shape editor". Per face: ready-made shapes (basic, lines, arrows, free-form), or **Draw your own** — tap points, lines join them, tap the first point to close a filled shape (or finish as an open line). Points snap to a 64 px grid and onto other shapes' corners, so lines can be joined up. Shapes can be moved, resized, turned, mirrored, recoloured, outlined and reordered; every finished change is one undo step.

All drawing goes through `src/lib/shapes.js` (canvas `Path2D`), used by both the editor and the 3D box, so the editor shows exactly what lands on the face. Pen shapes store their corners as a flat number list (`pts`) because Firestore can't store arrays inside arrays. Old square / circle / star stickers still load.

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

// Practice net for "guess before folding" (lib/cubeQuiz.js) when the box has no distinct faces.
import { VALID_CUBE_NETS } from "../components/canvas/netsConfig";
import { allTransforms } from "./netGeometry";
import { labelsToFaces } from "./shareLink";

export const DEFAULT_LETTERS = ["A", "B", "C", "D", "E", "F"];

const pick = (arr, rnd) => arr[Math.floor(rnd() * arr.length)];

function shuffle(arr, rnd) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** A fresh random practice net: random net, placement, and letters shuffled over the squares. */
export function randomPracticeNet(rnd = Math.random, letters = DEFAULT_LETTERS) {
  const netIndex = Math.floor(rnd() * VALID_CUBE_NETS.length);
  const transform = pick(allTransforms(), rnd);
  const labels = shuffle(letters, rnd);
  const turns = [0, 0, 0, 0, 0, 0];
  return { netIndex, transform, labels, turns, faceLabels: labelsToFaces(netIndex, transform, labels, turns) };
}

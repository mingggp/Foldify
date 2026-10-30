// "Guess before folding" — one short question at a time.
import { VALID_CUBE_NETS } from "../components/canvas/netsConfig";
import { allTransforms } from "./netGeometry";
import { labelsToFaces } from "./shareLink";

export const OPPOSITE = { top: "bottom", bottom: "top", front: "back", back: "front", left: "right", right: "left" };
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

/**
 * Ask "which face is opposite <label>?" for the given labelled faces.
 * faceLabels: { faceId: { label } }. Only faces with a label can be asked about / chosen.
 */
export function makeOppositeQuestion(faceLabels, rnd = Math.random, avoidFaceId = null) {
  const labelled = Object.keys(faceLabels).filter((id) => faceLabels[id]?.label);
  const askable = labelled.filter((id) => faceLabels[OPPOSITE[id]]?.label && id !== avoidFaceId);
  const pool = askable.length ? askable : labelled.filter((id) => faceLabels[OPPOSITE[id]]?.label);
  if (!pool.length) return null;
  const faceId = pick(pool, rnd);
  const choices = labelled.filter((id) => id !== faceId).map((id) => ({ faceId: id, label: faceLabels[id].label }));
  return {
    type: "opposite",
    faceId,
    label: faceLabels[faceId].label,
    answerFaceId: OPPOSITE[faceId],
    choices: shuffle(choices, rnd),
  };
}

/** A fresh random practice net: random net, placement, and letters shuffled over the squares. */
export function randomPracticeNet(rnd = Math.random, letters = DEFAULT_LETTERS) {
  const netIndex = Math.floor(rnd() * VALID_CUBE_NETS.length);
  const transform = pick(allTransforms(), rnd);
  const labels = shuffle(letters, rnd);
  const turns = [0, 0, 0, 0, 0, 0];
  return { netIndex, transform, labels, turns, faceLabels: labelsToFaces(netIndex, transform, labels, turns) };
}

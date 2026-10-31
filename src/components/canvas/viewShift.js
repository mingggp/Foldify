import { createContext } from "react";

/**
 * How many CSS pixels the 3D picture is moved sideways, so the box sits in the middle
 * of the space next to the docked tools panel while the canvas itself runs underneath
 * the (glass) panel. Provided by MainLayout, used by CustomCameraControls.
 */
export const ViewShiftContext = createContext(0);

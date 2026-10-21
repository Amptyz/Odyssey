/** Authored against the approved v7 board, not a regenerated approximation.
 * Frame metadata is shared with the offline outline measurement tool. */
export const MELEE_ART = {
  resource: 'art/melee-v3/keyframes-source', width: 1448, height: 1086,
  // Include the upper glow (the old 282px window cut through frames 6/7).
  cellWidth: 356, cellHeight: 293, pivot: { x: 178, y: 149 }, radius: 180,
  columns: [3, 365, 727, 1089], rows: [79, 412, 745],
  times: [0, 80, 120, 144, 168, 192, 216, 240, 270, 300, 330, 360],
} as const;

/** Source-art head registration only, used to blend adjacent images.
 * These points never define damage; meleeArea owns the filled sector. */
export const MELEE_BLADE_KEYS = [
  { progress: 0, points: [[0.72778,-0.13333],[0.76111,-0.18889],[0.73889,-0.30000],[0.66667,-0.42778],[0.55556,-0.52222],[0.43889,-0.56111],[0.53889,-0.42222],[0.65556,-0.23333]] },
  { progress: .2, points: [[0.63333,0.28889],[0.71111,0.20556],[0.82222,0.02778],[0.86667,-0.11667],[0.81111,-0.26111],[0.70000,-0.33889],[0.72222,-0.13333],[0.65556,0.08333]] },
  { progress: .4, points: [[0.25556,0.62778],[0.43889,0.58333],[0.61111,0.45556],[0.71667,0.30556],[0.76667,0.15556],[0.65000,0.07778],[0.56111,0.27222],[0.37222,0.46667]] },
  { progress: .6, points: [[-0.48889,0.64444],[-0.28889,0.72222],[0.00556,0.72222],[0.20556,0.65000],[0.29444,0.55556],[0.07778,0.51111],[-0.15556,0.55000],[-0.35556,0.54444]] },
  { progress: .8, points: [[-0.86667,0.38889],[-0.73333,0.54444],[-0.53889,0.64444],[-0.35000,0.68889],[-0.21111,0.61111],[-0.40556,0.48889],[-0.59444,0.38333],[-0.81111,0.22222]] },
  { progress: 1, points: [[-0.86667,0.38889],[-0.73333,0.54444],[-0.53889,0.64444],[-0.35000,0.68889],[-0.21111,0.61111],[-0.40556,0.48889],[-0.59444,0.38333],[-0.81111,0.22222]] },
] as const;

# Artes dos três golpes

Geradas com a ferramenta integrada de imagens, usando o retrato de Arthur e
`Cavaleiro em Três Golpes Épicos.png` como referências. Sem CLI/API.

Assets finais: `public/assets/characters/arthur/attack-quick.png`,
`public/assets/characters/arthur/attack-normal.png` e
`public/assets/characters/arthur/attack-critical.png`.

Cada folha tem 1536×1024, grade de 4×2 e oito quadros de 384×512.

Prompt comum:

```text
Create a production game sprite sheet on a genuinely transparent background. Image 1 is Arthur's exact identity reference; image 2 shows the three attack concepts requested by the user. Preserve the same black-haired faceless knight, dark gray scalloped armor, red cape, gray shield with cross, low-poly geometric aesthetic, and sword. Output exactly 1536x1024 pixels, uniform 4-column by 2-row grid (8 cells, each 384x512). No grid lines, no labels, no text, no ground oval, no background. EXACTLY ONE full-body knight per cell. All knights face RIGHT. Fixed camera, identical character scale: neutral body approximately 210 pixels tall, feet anchored at x=160 y=440 WITHIN EVERY CELL; keep entire body, sword and all effects inside its cell, with at least 12px margins. Animation proceeds row-major left-to-right then next row. Eight DISTINCT sequential frames: 1 neutral guard, 2 anticipation, 3 windup, 4 accelerating attack, 5 main strike/contact pose, 6 follow-through, 7 recovering, 8 neutral guard matching frame 1. It must depict true progressive movement of arms, legs, torso, shield and cape across the frames, not eight repeated poses and not three illustrations. Keep composition registered so feet don't jump. Thin white stylized slash effect only during strike frames 4-6.
```

## quick

```text
Animate the BOTTOM LEFT concept in image 2: a fast forward sword THRUST. Crouch back slightly on frame 2, pull sword arm back on frame 3, lunge forward extending sword nearly horizontal in frames 4-5, recover body and sword to guard in 6-8. White thin straight speed streaks along blade during thrust. No crescent arc. Total movement clean and readable.
```

## normal

```text
Animate the TOP concept in image 2: a sweeping diagonal SWORD SLASH in a broad crescent arc. Frame 2 bend knees, frame 3 sword raised back behind head, frames 4-5 sword sweeps diagonally forward and down with curved white crescent trail, frame 6 follow through blade low forward, 7 draw back, 8 neutral guard. Strong torso twist, cape swings.
```

## critical

```text
Animate the BOTTOM RIGHT concept in image 2: powerful OVERHEAD DOWNWARD SWORD SLAM. Frame 2 crouch, frame 3 sword high overhead with arm raised, frame 4 downward acceleration, frame 5 blade hits ground forward with narrow vertical white slash and tiny angular dust burst, frame 6 crouched follow-through, 7 rise and pull sword back, 8 neutral guard. Clearly different from a horizontal slash or thrust. Keep dust and slash inside cell.
```

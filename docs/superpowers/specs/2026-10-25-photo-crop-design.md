# Photo crop and zoom

Let the website manager frame every newly selected photo before it uploads, including each Before and After gallery image. The user confirmed every upload is in scope.

Use an in-browser crop dialog with drag/pointer repositioning, keyboard arrow controls, 1–4× zoom, crop-shape presets, Reset, Cancel and Use photo. Start with a suitable shape for the destination; gallery photos use a fixed 4:5 frame matching the public gallery. The preview and exported pixels use the same source rectangle. Export at most 2200 pixels on the longer edge without enlarging the original crop.

Keep the existing marketing photo approval step and the gallery authorization checks. Cropping stays local until the existing upload action. Cancel leaves the previous photo/draft untouched. Selected gallery crops stay in memory until Save result; both photos must be prepared before saving. Preserve PNG transparency; other crops become JPEG. Retain existing 5 MB marketing and 20 MB gallery input limits, and the 5 MB output limit.

Approach: export cropped pixels with Canvas, which works with existing storage and public pages. Saving crop coordinates instead would require public renderer and data changes; an external editor would interrupt the upload flow. A local pixel crop is the implementation choice. No database or authentication changes are needed.

Verify crop boundaries, zoom clamping, output sizing, cancellation, keyboard/pointer movement, repeated selections, gallery draft persistence, and local-demo saving. Use synthetic images only. Prepare a reviewable preview before publishing.

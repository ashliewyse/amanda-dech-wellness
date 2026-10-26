# Photo Crop and Zoom Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement in this session.

**Goal:** Frame every uploaded photo with crop and zoom before saving.
**Architecture:** A shared crop dialog exports a File, then hands it to the existing upload flow. Gallery drafts retain the prepared File separately from the native file input.
**Tech Stack:** Plain JavaScript, Canvas, native dialog and pointer events, Node built-in tests.
**Spec:** ../specs/2026-10-25-photo-crop-design.md

## Global Constraints

- No new dependencies, schema changes, or live content mutations during tests.
- Preserve photo approval and gallery authorization steps.
- Input limits: marketing 5 MB, gallery 20 MB; output 5 MB, longest edge 2200 px.
- Preview and export share the source rectangle; PNG keeps transparency.

## Review Focus

- Tall/wide images and extreme drags never reveal empty canvas.
- Cancel during loading/export cannot resolve a later crop or change the prior draft.
- A canceled replacement preserves the prior gallery file and native validation permits it.
- Resize/touch/keyboard interaction retains the selected crop.
- Exports, file-type limits and decode failures never trigger an unintended upload.

### Task 1: Crop geometry and editor

Files: photo-crop-math.js, photo-crop.js, tests/photo-crop.test.cjs; admin.html/admin.css.
Interfaces: AmandaCropMath.getCropRect({width,height,aspect,zoom,panX,panY}); fitOutput(rect,maxDimension). AmandaPhotoCropper.open(file,{aspect,label,maxBytes}) -> Promise<File|null>.

- [x] Add failing tests with literal source rectangles, boundary clamps and non-upscaled output sizes; run node --test.
- [x] Implement geometry, shared dialog, pointer/keyboard controls and Canvas export; run node --test.

### Task 2: Upload integration and verification

Files: admin.js, admin.html; reuse the cropper interface from Task 1.

- [x] Route approved marketing selections through cropping; upload only a returned File.
- [x] Store separate before/after cropped gallery files, preserve old drafts on cancel, clear on Save/Cancel result.
- [x] Run the Node suite and syntax checks; exercise desktop/mobile local demo with synthetic images. Confirm no Supabase writes.
- [x] Request one independent code review, fix material findings, rerun the suite and prepare a preview/PR.

## Verification

Nine Node tests pass. Syntax and whitespace checks pass. Local browser checks covered marketing photo approval to crop/save, 1-4x zoom, pointer drag, arrow controls, reset, preserving an earlier gallery crop on cancel and decode failure, saving both prepared gallery files, and a 390px-wide layout. Synthetic images and preview mode were used. Review found a gallery PNG-to-JPEG conversion; it was corrected by uploading the prepared crop unchanged with matching MIME type and extension. Three regression checks were observed failing before the fix, then all nine tests passed.

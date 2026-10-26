const test = require('node:test');
const assert = require('node:assert/strict');
const { galleryUpload } = require('../photo-upload.js');

test('gallery upload preserves the prepared PNG bytes and alpha-capable MIME type', async () => {
    const file = new File([new Uint8Array([137,80,78,71,13,10,26,10])], 'crop.png', { type: 'image/png' });
    const upload = galleryUpload(file, 'sample-case', 'before');
    assert.equal(upload.path, 'gallery/sample-case/before.png');
    assert.equal(upload.contentType, 'image/png');
    assert.equal(upload.body, file);
    assert.deepEqual(new Uint8Array(await upload.body.arrayBuffer()), new Uint8Array([137,80,78,71,13,10,26,10]));
});
test('JPEG crops use a matching extension and upload MIME type', () => {
    const file = new File(['sample'], 'crop.jpg', { type: 'image/jpeg' });
    const upload = galleryUpload(file, 'sample-case', 'after');
    assert.equal(upload.path, 'gallery/sample-case/after.jpg');
    assert.equal(upload.contentType, 'image/jpeg');
    assert.equal(upload.body, file);
});
test('unsupported or oversized output cannot reach a gallery upload', () => {
    assert.throws(() => galleryUpload(new File(['x'], 'x.svg', {type:'image/svg+xml'}), 'case', 'before'), /prepared/i);
    assert.throws(() => galleryUpload({size:5*1024*1024+1,type:'image/png'}, 'case', 'before'), /5 MB/i);
});

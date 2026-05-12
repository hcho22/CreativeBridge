// Jest stub for binary asset imports (.bin files used by whisper.rn models).
//
// In production, Metro replaces `require('foo.bin')` with a numeric asset ID
// that `expo-asset`'s `Asset.fromModule(id)` knows how to resolve. In Jest,
// there is no Metro, so we substitute a fixed numeric ID. The tests that
// consume this don't care about the value — they mock `Asset.fromModule`
// itself — but a number keeps the type loose-equivalence with the real
// asset reference shape.
module.exports = 1;

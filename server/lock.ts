// One instance owns the SQLite database. Serialize writes and background work,
// including asynchronous image processing and backup snapshots.
let tail: Promise<void> = Promise.resolve();
export async function acquireWriteLock() {
  let release!: () => void;
  const prior = tail;
  tail = new Promise<void>((resolve) => {
    release = resolve;
  });
  await prior;
  return release;
}

document.addEventListener('DOMContentLoaded', async () => {
    const inlineCounter = 'inline/counter';
    const pkgSignals = 'pkg:signals';

    const {effect} = await import(pkgSignals);
    const {counter} = await import(inlineCounter);

    effect(() => {
        console.debug('inline counter updated:', counter());
    });
});
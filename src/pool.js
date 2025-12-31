export async function ejecutarConPool(items, limit, worker) {
    const ejecutando = new Set();

    for (const item of items) {
        const p = Promise.resolve().then(() => worker(item));
        ejecutando.add(p);

        const limpiar = () => ejecutando.delete(p);
        p.then(limpiar).catch(limpiar);

        if (ejecutando.size >= limit) {
            await Promise.race(ejecutando);
        }
    }

    await Promise.all(ejecutando);
}

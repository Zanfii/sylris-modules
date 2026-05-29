let timeout = 0;

function setImages() {
    const elements = document.getElementsByClassName("placeable-entry");
    const tokenLayer = game.canvas.layers.find(e => e.name === "TokenLayer");

    if (!elements.length || !tokenLayer) {
        return;
    }

    [...elements].forEach(element => {
        const id = element.getAttribute("data-entry-id");
        const token = tokenLayer.placeables.find(e => e.id === id);
        const imgpath = token?.document?.texture?.src; //token.actor.img

        if (!id || !token || !imgpath) {
            return;
        }

        let img = element.querySelector(".sylris-placeable-img");

        if (!img) {
            img = document.createElement("img");
            img.classList.add("sylris-placeable-img");

            const description = element.querySelector(".description");
            description?.prepend(img);
        }

        if (img.getAttribute("src") !== imgpath) {
            img.setAttribute("src", imgpath);
        }
    });
}

function delayedRepeatedCall() {
    clearTimeout(timeout);

    setImages();

    requestAnimationFrame(() => {
        setImages();
    });

    timeout = setTimeout(() => {
        setImages();
    }, 50);
}

Hooks.once("ready", () => {
    delayedRepeatedCall();
});

Hooks.on("renderApplication", () => {
    delayedRepeatedCall();
});

Hooks.on("canvasReady", () => {
    delayedRepeatedCall();
});

Hooks.on("createToken", () => {
    delayedRepeatedCall();
});

Hooks.on("updateToken", () => {
    delayedRepeatedCall();
});

Hooks.on("deleteToken", () => {
    delayedRepeatedCall();
});

Hooks.on("updateActor", () => {
    delayedRepeatedCall();
});

Hooks.on("hoverToken", () => {
    delayedRepeatedCall();
});

Hooks.on("refreshToken", () => {
    delayedRepeatedCall();
});

Hooks.on("controlToken", () => {
    delayedRepeatedCall();
});

Hooks.on("moveToken", () => {
    delayedRepeatedCall();
});
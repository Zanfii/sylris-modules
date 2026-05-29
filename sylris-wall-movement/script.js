Hooks.on('preUpdateToken', (token, changes, data, ...args) => {
  if(!(changes.x || changes.y) || data.animate === false){ return};

          data.animate = true;
          let target = { x: changes?.x ?? token.x, y: changes?.y ?? token.y };
          const ray = new Ray(
              { x: token.x, y: token.y },
              target
          );
          if (token._object.checkCollision(target)){
            data.animate = false
          };

          if (data.animate) {
           // foundry.utils.setProperty(data, `animation`, {
           //      movementSpeed: 1,
           //      duration: ray.distance,
           //      easing: "linear"
           //  });
          }
});
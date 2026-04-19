(() => {
  function getRectGap1D(aLeft, aRight, bLeft, bRight) {
    return Math.max(0, bLeft - aRight, aLeft - bRight);
  }

  function getRoundedRectTopRestY(player, surface) {
    const gapX = getRectGap1D(
      player.x + player.radius,
      player.x + player.width - player.radius,
      surface.x + surface.radius,
      surface.x + surface.width - surface.radius
    );
    const radiusSum = player.radius + surface.radius;
    if (gapX >= radiusSum) return null;
    const gapY = Math.sqrt(Math.max(0, radiusSum * radiusSum - gapX * gapX));
    return surface.y + surface.radius - gapY - (player.height - player.radius);
  }

  function getRoundedRectBottomRestY(player, surface) {
    const gapX = getRectGap1D(
      player.x + player.radius,
      player.x + player.width - player.radius,
      surface.x + surface.radius,
      surface.x + surface.width - surface.radius
    );
    const radiusSum = player.radius + surface.radius;
    if (gapX >= radiusSum) return null;
    const gapY = Math.sqrt(Math.max(0, radiusSum * radiusSum - gapX * gapX));
    return surface.y + surface.height - surface.radius + gapY - player.radius;
  }

  function getRoundedRectLeftRestX(player, surface) {
    const gapY = getRectGap1D(
      player.y + player.radius,
      player.y + player.height - player.radius,
      surface.y + surface.radius,
      surface.y + surface.height - surface.radius
    );
    const radiusSum = player.radius + surface.radius;
    if (gapY >= radiusSum) return null;
    const gapX = Math.sqrt(Math.max(0, radiusSum * radiusSum - gapY * gapY));
    return surface.x + surface.radius - gapX - (player.width - player.radius);
  }

  function getRoundedRectRightRestX(player, surface) {
    const gapY = getRectGap1D(
      player.y + player.radius,
      player.y + player.height - player.radius,
      surface.y + surface.radius,
      surface.y + surface.height - surface.radius
    );
    const radiusSum = player.radius + surface.radius;
    if (gapY >= radiusSum) return null;
    const gapX = Math.sqrt(Math.max(0, radiusSum * radiusSum - gapY * gapY));
    return surface.x + surface.width - surface.radius + gapX - player.radius;
  }

  function pointInRect(px, py, rect) {
    return px >= rect.left && px <= rect.right && py >= rect.top && py <= rect.bottom;
  }

  function closestPointOnRect(px, py, rect) {
    return {
      x: Math.max(rect.left, Math.min(rect.right, px)),
      y: Math.max(rect.top, Math.min(rect.bottom, py)),
    };
  }

  function pointRectDistanceSq(px, py, rect) {
    const closest = closestPointOnRect(px, py, rect);
    const dx = px - closest.x;
    const dy = py - closest.y;
    return dx * dx + dy * dy;
  }

  function pointSegmentDistanceSq(px, py, ax, ay, bx, by) {
    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) {
      const ox = px - ax;
      const oy = py - ay;
      return ox * ox + oy * oy;
    }
    let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const cx = ax + dx * t;
    const cy = ay + dy * t;
    const ox = px - cx;
    const oy = py - cy;
    return ox * ox + oy * oy;
  }

  function orientation(ax, ay, bx, by, cx, cy) {
    return (by - ay) * (cx - bx) - (bx - ax) * (cy - by);
  }

  function onSegment(ax, ay, bx, by, cx, cy) {
    return cx >= Math.min(ax, bx) && cx <= Math.max(ax, bx) && cy >= Math.min(ay, by) && cy <= Math.max(ay, by);
  }

  function segmentsIntersect(ax, ay, bx, by, cx, cy, dx, dy) {
    const EPS = 1e-9;
    const o1 = orientation(ax, ay, bx, by, cx, cy);
    const o2 = orientation(ax, ay, bx, by, dx, dy);
    const o3 = orientation(cx, cy, dx, dy, ax, ay);
    const o4 = orientation(cx, cy, dx, dy, bx, by);

    if (Math.abs(o1) < EPS && onSegment(ax, ay, bx, by, cx, cy)) return true;
    if (Math.abs(o2) < EPS && onSegment(ax, ay, bx, by, dx, dy)) return true;
    if (Math.abs(o3) < EPS && onSegment(cx, cy, dx, dy, ax, ay)) return true;
    if (Math.abs(o4) < EPS && onSegment(cx, cy, dx, dy, bx, by)) return true;

    return (o1 > 0) !== (o2 > 0) && (o3 > 0) !== (o4 > 0);
  }

  function segmentRectDistanceSq(ax, ay, bx, by, rect) {
    if (pointInRect(ax, ay, rect) || pointInRect(bx, by, rect)) return 0;

    const edges = [
      [rect.left, rect.top, rect.right, rect.top],
      [rect.right, rect.top, rect.right, rect.bottom],
      [rect.right, rect.bottom, rect.left, rect.bottom],
      [rect.left, rect.bottom, rect.left, rect.top],
    ];

    for (const [ex1, ey1, ex2, ey2] of edges) {
      if (segmentsIntersect(ax, ay, bx, by, ex1, ey1, ex2, ey2)) return 0;
    }

    let min = Infinity;
    for (const [ex1, ey1, ex2, ey2] of edges) {
      min = Math.min(
        min,
        pointSegmentDistanceSq(ax, ay, ex1, ey1, ex2, ey2),
        pointSegmentDistanceSq(bx, by, ex1, ey1, ex2, ey2),
        pointSegmentDistanceSq(ex1, ey1, ax, ay, bx, by),
        pointSegmentDistanceSq(ex2, ey2, ax, ay, bx, by)
      );
    }
    return min;
  }

  function closestPointOnSegment(px, py, ax, ay, bx, by) {
    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) {
      return { x: ax, y: ay, t: 0 };
    }
    let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    return {
      x: ax + dx * t,
      y: ay + dy * t,
      t,
    };
  }

  function getWindmillCollision(player, windmills) {
    const coreRect = {
      left: player.x + player.radius,
      top: player.y + player.radius,
      right: player.x + player.width - player.radius,
      bottom: player.y + player.height - player.radius,
    };
    const centerX = player.x + player.width / 2;
    const centerY = player.y + player.height / 2;
    let best = null;

    for (const windmill of windmills) {
      const bladeRadius = windmill.bladeThickness * 0.5;
      const hubRadius = windmill.hubRadius ?? 10;
      const hubThreshold = player.radius + hubRadius;
      const hubDistSq = pointRectDistanceSq(windmill.centerX, windmill.centerY, coreRect);
      if (hubDistSq <= hubThreshold * hubThreshold && (!best || hubDistSq < best.distSq)) {
        const closest = closestPointOnRect(windmill.centerX, windmill.centerY, coreRect);
        let normalX = windmill.centerX - closest.x;
        let normalY = windmill.centerY - closest.y;
        let normalLen = Math.hypot(normalX, normalY);
        if (normalLen < 0.001) {
          normalX = centerX - windmill.centerX;
          normalY = centerY - windmill.centerY;
          normalLen = Math.hypot(normalX, normalY) || 1;
        }
        normalX /= normalLen;
        normalY /= normalLen;
        best = {
          distSq: hubDistSq,
          threshold: hubThreshold,
          closestX: closest.x,
          closestY: closest.y,
          normalX,
          normalY,
          bladeVelX: 0,
          bladeVelY: 0,
          windmill,
        };
      }

      for (const offset of windmill.bladeOffsets) {
        const angle = windmill.blades.rotation + offset;
        const ax = windmill.centerX;
        const ay = windmill.centerY;
        const bx = windmill.centerX + Math.sin(angle) * windmill.bladeLength;
        const by = windmill.centerY - Math.cos(angle) * windmill.bladeLength;
        const distSq = segmentRectDistanceSq(ax, ay, bx, by, coreRect);
        const threshold = player.radius + bladeRadius;
        if (distSq > threshold * threshold) continue;
        const closest = closestPointOnSegment(centerX, centerY, ax, ay, bx, by);
        const dx = centerX - closest.x;
        const dy = centerY - closest.y;
        if (!best || distSq < best.distSq) {
          let normalX = dx;
          let normalY = dy;
          let normalLen = Math.hypot(normalX, normalY);
          if (normalLen < 0.001) {
            normalX = ay - by;
            normalY = bx - ax;
            normalLen = Math.hypot(normalX, normalY) || 1;
            const toCenterX = centerX - windmill.centerX;
            const toCenterY = centerY - windmill.centerY;
            if (normalX * toCenterX + normalY * toCenterY < 0) {
              normalX = -normalX;
              normalY = -normalY;
            }
          }
          normalX /= normalLen;
          normalY /= normalLen;
          const bladeVelX = -windmill.speed * (closest.y - windmill.centerY);
          const bladeVelY = windmill.speed * (closest.x - windmill.centerX);
          best = {
            distSq,
            threshold,
            closestX: closest.x,
            closestY: closest.y,
            normalX,
            normalY,
            bladeVelX,
            bladeVelY,
            windmill,
          };
        }
      }
    }

    return best;
  }

  class Square {
    constructor(ctx, x, y, size = 44, color = 0xffffff) {
      this.ctx = ctx;
      this.vx = 0;
      this.vy = 0;
      this.gravity = 0.52;
      this.size = size;
      this.color = color;
      this.dragging = false;
      this.pullX = 0;
      this.pullY = 0;
      this.onGround = false;

      this.gfx = new PIXI.Graphics();
      this.gfx.x = x;
      this.gfx.y = y;
      this.drawSquare();
      this.ctx.world.addChild(this.gfx);

      this.gfx.eventMode = 'static';
      this.gfx.cursor = 'grab';
      this.gfx.hitArea = new PIXI.RoundedRectangle(0, 0, this.size, this.size, this.ctx.PLAYER_RADIUS);
      this.gfx.on('pointerdown', (e) => this.onDown(e));
    }

    drawSquare() {
      this.gfx.clear();
      this.gfx.beginFill(0x1a1a1a);
      this.gfx.drawRoundedRect(0, 0, this.size, this.size, this.ctx.PLAYER_RADIUS);
      this.gfx.endFill();
      this.gfx.beginFill(this.color);
      this.gfx.drawRoundedRect(
        this.ctx.PLAYER_BORDER,
        this.ctx.PLAYER_BORDER,
        this.size - this.ctx.PLAYER_BORDER * 2,
        this.size - this.ctx.PLAYER_BORDER * 2,
        Math.max(0, this.ctx.PLAYER_RADIUS - this.ctx.PLAYER_BORDER)
      );
      this.gfx.endFill();
    }

    drawDots() {
      this.ctx.dotLayer.clear();
      if (!this.dragging) return;

      const cx = this.gfx.x + this.size / 2;
      const cy = this.gfx.y + this.size / 2;
      const px = cx + this.pullX;
      const py = cy + this.pullY;
      const dist = Math.sqrt(this.pullX ** 2 + this.pullY ** 2);
      if (dist < 4) return;

      const DOT_SPACING = 10;
      const count = Math.floor(dist / DOT_SPACING);

      for (let i = 1; i <= count; i++) {
        const t = i / (count + 1);
        const dx = cx + (px - cx) * t;
        const dy = cy + (py - cy) * t;
        const r = 3.5 - t * 1.5;
        const alpha = 0.9 - t * 0.55;
        this.ctx.dotLayer.beginFill(0x1a1a1a, alpha);
        this.ctx.dotLayer.drawCircle(dx, dy, Math.max(r, 1));
        this.ctx.dotLayer.endFill();
      }
    }

    onDown() {
      if (this.dragging || this.moving() || !this.onGround) return;
      this.dragging = true;
      this.gfx.cursor = 'grabbing';
      this.vx = 0;
      this.vy = 0;
      this._onMove = (e2) => this.onMove(e2);
      this._onUp = () => this.onUp();
      this.ctx.app.stage.on('globalpointermove', this._onMove);
      this.ctx.app.stage.on('globalpointerup', this._onUp);
      this.ctx.app.stage.on('globalpointerupoutside', this._onUp);
      this.ctx.app.stage.on('globalpointercancel', this._onUp);
      this.gfx.on('pointerup', this._onUp);
      this.gfx.on('pointerupoutside', this._onUp);
      this.gfx.on('pointercancel', this._onUp);
    }

    onMove(e) {
      if (!this.dragging) return;
      const local = this.ctx.world.toLocal(e.global);
      const cx = this.gfx.x + this.size / 2;
      const cy = this.gfx.y + this.size / 2;
      let pullX = local.x - cx;
      let pullY = local.y - cy;
      const dist = Math.hypot(pullX, pullY);
      if (dist > this.ctx.MAX_PULL) {
        const scale = this.ctx.MAX_PULL / dist;
        pullX *= scale;
        pullY *= scale;
      }
      this.pullX = pullX;
      this.pullY = pullY;
      this.drawDots();
    }

    onUp() {
      if (!this.dragging) return;
      this.dragging = false;
      this.gfx.cursor = 'grab';

      const POWER = 0.094;
      this.vx = -this.pullX * POWER;
      this.vy = -this.pullY * POWER;
      this.pullX = 0;
      this.pullY = 0;

      this.ctx.dotLayer.clear();
      this.ctx.app.stage.off('globalpointermove', this._onMove);
      this.ctx.app.stage.off('globalpointerup', this._onUp);
      this.ctx.app.stage.off('globalpointerupoutside', this._onUp);
      this.ctx.app.stage.off('globalpointercancel', this._onUp);
      this.gfx.off('pointerup', this._onUp);
      this.gfx.off('pointerupoutside', this._onUp);
      this.gfx.off('pointercancel', this._onUp);
    }

    moving() {
      return Math.abs(this.vx) > 0.05 || Math.abs(this.vy) > 0.05;
    }

    update() {
      if (this.dragging) return;
      const prevX = this.gfx.x;
      const prevY = this.gfx.y;
      this.vy += this.gravity;
      this.gfx.x += this.vx;
      this.gfx.y += this.vy;
      const RESTITUTION = 0.28;
      const GROUND_FRICTION = 0.84;

      if (this.gfx.x < 0) { this.gfx.x = 0; this.vx = Math.abs(this.vx) * RESTITUTION; }
      if (this.gfx.x + this.size > this.ctx.MAP_W) { this.gfx.x = this.ctx.MAP_W - this.size; this.vx = -Math.abs(this.vx) * RESTITUTION; }
      const playerShape = {
        x: this.gfx.x,
        y: this.gfx.y,
        width: this.size,
        height: this.size,
        radius: this.ctx.PLAYER_RADIUS,
      };

      let supportedByWindmill = false;
      const windmillHit = getWindmillCollision(playerShape, this.ctx.windmills || []);
      if (windmillHit) {
        const overlap = Math.max(0, windmillHit.threshold - Math.sqrt(windmillHit.distSq));
        const push = overlap + 0.5;
        this.gfx.x += windmillHit.normalX * push;
        this.gfx.y += windmillHit.normalY * push;
        if (windmillHit.normalY < -0.2 && this.vy >= 0) {
          this.gfx.x += windmillHit.bladeVelX;
          this.gfx.y += windmillHit.bladeVelY;
          this.vy = 0;
          supportedByWindmill = true;
          this.vx += windmillHit.bladeVelX * 0.3;
        } else {
          this.vx = -this.vx * 0.45;
          this.vy = -this.vy * 0.45;
        }
        playerShape.x = this.gfx.x;
        playerShape.y = this.gfx.y;
      }

      let leftSurface = null;
      let leftX = Infinity;
      if (this.vx > 0) {
        for (const surface of this.ctx.stickSurfaces) {
          const contact = getRoundedRectLeftRestX(playerShape, surface);
          if (contact === null) continue;
          if (prevX <= contact && this.gfx.x >= contact && contact < leftX) {
            leftSurface = surface;
            leftX = contact;
          }
        }
      }

      let rightSurface = null;
      let rightX = -Infinity;
      if (this.vx < 0) {
        for (const surface of this.ctx.stickSurfaces) {
          const contact = getRoundedRectRightRestX(playerShape, surface);
          if (contact === null) continue;
          if (prevX >= contact && this.gfx.x <= contact && contact > rightX) {
            rightSurface = surface;
            rightX = contact;
          }
        }
      }

      if (leftSurface) {
        this.gfx.x = leftX;
        this.vx = 0;
        playerShape.x = this.gfx.x;
      } else if (rightSurface) {
        this.gfx.x = rightX;
        this.vx = 0;
        playerShape.x = this.gfx.x;
      }

      let landingSurface = null;
      let landingY = Infinity;
      let landedOnGround = false;
      if (this.vy >= 0) {
        for (const surface of this.ctx.stickSurfaces) {
          const contact = getRoundedRectTopRestY(playerShape, surface);
          if (contact === null) continue;
          const crossedTop = prevY <= contact && this.gfx.y >= contact;
          if (crossedTop && contact < landingY) {
            landingSurface = surface;
            landingY = contact;
            landedOnGround = false;
          }
        }

        const groundContact = this.ctx.GROUND_Y - this.size;
        if (prevY <= groundContact && this.gfx.y >= groundContact && groundContact < landingY) {
          landingSurface = null;
          landingY = groundContact;
          landedOnGround = true;
        }
      }

      let ceilingSurface = null;
      let ceilingY = -Infinity;
      if (this.vy < 0) {
        for (const surface of this.ctx.stickSurfaces) {
          const contact = getRoundedRectBottomRestY(playerShape, surface);
          if (contact === null) continue;
          const crossedBottom = prevY >= contact && this.gfx.y <= contact;
          if (crossedBottom) {
            if (contact > ceilingY) {
              ceilingSurface = surface;
              ceilingY = contact;
            }
          }
        }
      }

      if (ceilingSurface) {
        this.gfx.y = ceilingY;
        this.vy = Math.abs(this.vy) * RESTITUTION;
      } else if (landingSurface || landedOnGround) {
        this.gfx.y = landingY;
        if (Math.abs(this.vy) < 0.6) {
          this.vy = 0;
        } else {
          this.vy = -Math.abs(this.vy) * RESTITUTION;
        }
        this.onGround = true;
        this.vx *= GROUND_FRICTION;
      } else {
        this.onGround = supportedByWindmill;
      }

      if (supportedByWindmill) {
        this.onGround = true;
      }

      if (Math.abs(this.vx) < 0.002) this.vx = 0;
      if (Math.abs(this.vy) < 0.002) this.vy = 0;
    }
  }

  window.UpUpUpLogic = {
    getRectGap1D,
    getRoundedRectTopRestY,
    getRoundedRectBottomRestY,
    getRoundedRectLeftRestX,
    getRoundedRectRightRestX,
    getWindmillCollision,
    Square,
  };
})();

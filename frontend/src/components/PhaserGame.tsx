'use client';
import { useEffect, useRef } from 'react';

export default function PhaserGame({ gameType }: { gameType: 'angry_birds' | 'flappy_birds' | 'cars' }) {
  const gameRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let isMounted = true;
    
    import('phaser').then((Phaser) => {
      if (!isMounted) return;
      if (gameRef.current) return;

      const config: any = {
        type: Phaser.AUTO,
        parent: 'phaser-container',
        transparent: true,
        scale: {
          mode: Phaser.Scale.FIT,
          autoCenter: Phaser.Scale.CENTER_BOTH,
          width: 800,
          height: 600
        },
        physics: {
          default: gameType === 'angry_birds' ? 'matter' : 'arcade',
          matter: {
            gravity: { y: 1 },
            debug: false,
            enableSleeping: true
          },
          arcade: {
            gravity: { y: gameType === 'flappy_birds' ? 1200 : 0 },
            debug: false
          }
        },
        scene: {
          preload: preload,
          create: create,
          update: update
        }
      };

      gameRef.current = new Phaser.Game(config);

      let w = 800;
      let h = 600;

      // --- Angry Birds ---
      let bird: any;
      let startPoint = { x: 180, y: 440 };
      let graphics: any; 
      let pigs: any[] = [];
      let blocks: any[] = [];
      let agentStateAB = 'idle'; // idle, dragging, launched, reset
      let agentTimerAB = 0;
      let dragTarget = { x: 180, y: 440 };

      // --- Flappy Bird ---
      let flappyBird: any;
      let pipes: any;
      let scoreText: any;
      let score = 0;
      let isGameOver = false;

      // --- Cars ---
      let car: any;
      let trackBounds: any;

      function preload(this: any) {
        if (gameType === 'angry_birds') {
          this.load.image('bg', '/assets/angry_birds_bg.png');
          this.load.image('bird', '/assets/angry_bird_red.png');
          this.load.image('pig', '/assets/pig_enemy.png');
          this.load.image('crate', '/assets/wooden_crate.png');
        } else if (gameType === 'flappy_birds') {
          this.load.image('fbg', '/assets/flappy_bg.png');
          this.load.image('fbird', '/assets/angry_bird_red.png'); 
          this.load.image('pipe', '/assets/flappy_pipe.png'); 
        } else if (gameType === 'cars') {
          this.load.image('track', '/assets/race_track.png');
          this.load.image('car', '/assets/race_car.png');
        }
      }

      function create(this: any) {
        // Base logical size
        w = 800;
        h = 600;

        if (gameType === 'angry_birds') {
          pigs = [];
          blocks = [];
          agentStateAB = 'idle';
          agentTimerAB = 0;
          
          const bg = this.add.image(w/2, h/2, 'bg');
          bg.setDisplaySize(w, h);
          bg.setDepth(-2);
          
          // Extended ground for simulation
          this.matter.add.rectangle(w/2, h - 10, w * 1.5, 60, { isStatic: true, friction: 1.0 });
          // Boundaries to keep physics objects inside
          this.matter.add.rectangle(-50, h/2, 100, h, { isStatic: true });
          this.matter.add.rectangle(w + 50, h/2, 100, h, { isStatic: true });

          this.add.rectangle(180, 520, 16, 120, 0x4a2e12).setDepth(-1); // Slingshot Post
          graphics = this.add.graphics();
          graphics.setDepth(1);

          bird = this.matter.add.image(startPoint.x, startPoint.y, 'bird', null, { 
            shape: { type: 'circle', radius: 15 }, 
            frictionAir: 0.01,
            density: 0.005,
            restitution: 0.4
          });
          bird.setDisplaySize(32, 32);
          bird.setIgnoreGravity(true);

          // Build a physics stack precisely placed
          for (let i = 0; i < 3; i++) {
            const yBase = h - 65 - (i * 90);
            
            const crate1 = this.matter.add.image(550, yBase, 'crate', null, { shape: { type: 'rectangle', width: 40, height: 40 }, friction: 0.8, density: 0.002 });
            crate1.setDisplaySize(40, 40);
            blocks.push(crate1);
            
            const crate2 = this.matter.add.image(650, yBase, 'crate', null, { shape: { type: 'rectangle', width: 40, height: 40 }, friction: 0.8, density: 0.002 });
            crate2.setDisplaySize(40, 40);
            blocks.push(crate2);
            
            const plank = this.matter.add.image(600, yBase - 25, 'crate', null, { shape: { type: 'rectangle', width: 140, height: 10 }, friction: 0.9, density: 0.003 });
            plank.setDisplaySize(140, 10);
            blocks.push(plank);
            
            if (i < 2) {
              const pig = this.matter.add.image(600, yBase - 45, 'pig', null, { shape: { type: 'circle', radius: 15 }, density: 0.001, restitution: 0.4 });
              pig.setDisplaySize(30, 30);
              pigs.push(pig);
            }
          }

        } else if (gameType === 'flappy_birds') {
          score = 0;
          isGameOver = false;

          const bg = this.add.image(w/2, h/2, 'fbg');
          bg.setDisplaySize(w, h);
          
          flappyBird = this.physics.add.sprite(200, h/2, 'fbird');
          flappyBird.setDisplaySize(35, 35);
          flappyBird.setCollideWorldBounds(true);
          flappyBird.setCircle(15);
          
          pipes = this.physics.add.group();

          scoreText = this.add.text(w/2 - 20, 50, '0', { fontSize: '48px', fill: '#fff', stroke: '#000', strokeThickness: 6 }).setDepth(10);

          this.time.addEvent({
            delay: 1500,
            loop: true,
            callback: () => {
              if (isGameOver) return;
              const gapY = Phaser.Math.Between(200, h - 200);
              const gapSize = 160;
              
              const topPipe = pipes.create(w + 50, gapY - gapSize/2, 'pipe');
              topPipe.setOrigin(0.5, 1);
              topPipe.setDisplaySize(70, 500);
              topPipe.setVelocityX(-200);
              topPipe.body.allowGravity = false;
              topPipe.setImmovable(true);
              topPipe.flipY = true;

              const bottomPipe = pipes.create(w + 50, gapY + gapSize/2, 'pipe');
              bottomPipe.setOrigin(0.5, 0);
              bottomPipe.setDisplaySize(70, 500);
              bottomPipe.setVelocityX(-200);
              bottomPipe.body.allowGravity = false;
              bottomPipe.setImmovable(true);

              const scoreZone = pipes.create(w + 50, gapY, 'pipe');
              scoreZone.setDisplaySize(20, gapSize);
              scoreZone.setVelocityX(-200);
              scoreZone.body.allowGravity = false;
              scoreZone.setVisible(false);
              scoreZone.isScoreZone = true;
            }
          });

          this.physics.add.overlap(flappyBird, pipes, (b: any, p: any) => {
            if (p.isScoreZone) {
              score++;
              scoreText.setText(score);
              p.destroy();
            } else {
              if (isGameOver) return;
              isGameOver = true;
              this.physics.pause();
              flappyBird.setTint(0xff0000);
              setTimeout(() => this.scene.restart(), 1500);
            }
          });

        } else if (gameType === 'cars') {
          const track = this.add.image(w/2, h/2, 'track');
          track.setDisplaySize(w, h);
          
          car = this.physics.add.sprite(w/2, h - 150, 'car');
          car.setDisplaySize(30, 60);
          car.setCollideWorldBounds(true);
          car.setDrag(0.95); 
          car.setDamping(true);
          car.setMaxVelocity(400);

          // Advanced Agent Waypoints (Smooth oval)
          trackBounds = [
            { x: 150, y: h - 150 },
            { x: 150, y: 150 },
            { x: w - 150, y: 150 },
            { x: w - 150, y: h - 150 }
          ];
          car.currentWaypoint = 0;
        }
      }

      function update(this: any, time: number, delta: number) {
        if (gameType === 'angry_birds') {
          // Autonomous Agent Playing Logic
          if (agentStateAB === 'idle') {
            agentTimerAB += delta;
            if (agentTimerAB > 1500) {
              agentStateAB = 'dragging';
              // Random optimal trajectory
              const angle = Phaser.Math.Between(20, 40) * (Math.PI / 180);
              const dist = Phaser.Math.Between(75, 85);
              dragTarget = {
                x: startPoint.x - Math.cos(angle) * dist,
                y: startPoint.y + Math.sin(angle) * dist
              };
            }
          } else if (agentStateAB === 'dragging') {
            // Smoothly simulate mouse drag
            bird.x += (dragTarget.x - bird.x) * 0.08;
            bird.y += (dragTarget.y - bird.y) * 0.08;
            
            // Draw slingshot elastic bands
            graphics.clear();
            graphics.lineStyle(6, 0x3a1e02, 1);
            graphics.beginPath();
            graphics.moveTo(170, 440);
            graphics.lineTo(bird.x, bird.y);
            graphics.strokePath();
            graphics.beginPath();
            graphics.moveTo(190, 440);
            graphics.lineTo(bird.x, bird.y);
            graphics.strokePath();

            if (Phaser.Math.Distance.Between(bird.x, bird.y, dragTarget.x, dragTarget.y) < 2) {
              agentStateAB = 'launched';
              bird.setIgnoreGravity(false);
              const dx = startPoint.x - bird.x;
              const dy = startPoint.y - bird.y;
              // Physics impulse multiplier to reach targets across the screen
              bird.setVelocity(dx * 0.38, dy * 0.38);
              graphics.clear();
              agentTimerAB = 0;
            }
          } else if (agentStateAB === 'launched') {
            agentTimerAB += delta;
            if (agentTimerAB > 5500) {
              this.scene.restart(); // Loop game
            }
          }

        }
        else if (gameType === 'flappy_birds') {
          if (!isGameOver && flappyBird) {
            // Rotate the bird smoothly like the real game
            if (flappyBird.body.velocity.y > 0) {
              flappyBird.angle += 3;
              if (flappyBird.angle > 90) flappyBird.angle = 90;
            } else {
              flappyBird.angle = -25;
            }

            if (flappyBird.y > h - 20) {
              isGameOver = true;
              this.physics.pause();
              flappyBird.setTint(0xff0000);
              setTimeout(() => this.scene.restart(), 1500);
            }
            
            // Auto-playing Agent Logic: Flappy Bird
            let closestPipe: any = null;
            let closestDist = 9999;
            pipes.getChildren().forEach((p: any) => {
              if (p.x > flappyBird.x - 40 && p.x < closestDist && p.isScoreZone) {
                closestDist = p.x;
                closestPipe = p;
              }
              if (p.x < -100) p.destroy();
            });

            if (closestPipe) {
              const targetY = closestPipe.y + 15; // Aim slightly below middle
              if (flappyBird.y > targetY && flappyBird.body.velocity.y >= 0) {
                 flappyBird.setVelocityY(-350);
              }
            } else {
               // Stay in middle if no pipes
               if (flappyBird.y > h/2 + 50 && flappyBird.body.velocity.y >= 0) {
                 flappyBird.setVelocityY(-350);
               }
            }
          }
        }
        else if (gameType === 'cars') {
          if (car && trackBounds) {
            // Auto-playing Agent Logic: Cars Race
            const target = trackBounds[car.currentWaypoint];
            const angleToTarget = Phaser.Math.Angle.Between(car.x, car.y, target.x, target.y);
            
            const targetAngle = angleToTarget + Math.PI/2;
            
            // Rotate smoothly towards the target waypoint
            car.rotation = Phaser.Math.Angle.RotateTo(car.rotation, targetAngle, 0.08);
            
            // Accelerate in the direction facing
            this.physics.velocityFromRotation(car.rotation - Math.PI/2, 350, car.body.velocity);

            if (Phaser.Math.Distance.Between(car.x, car.y, target.x, target.y) < 120) {
              car.currentWaypoint = (car.currentWaypoint + 1) % trackBounds.length;
            }
          }
        }
      }

    });

    return () => {
      isMounted = false;
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, [gameType]);

  return (
    <div id="phaser-container" className="w-full h-full" style={{ minHeight: '100%', minWidth: '100%' }} />
  );
}

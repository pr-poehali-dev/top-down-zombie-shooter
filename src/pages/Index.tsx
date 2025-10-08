import { useState, useEffect, useRef, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';

interface Position {
  x: number;
  y: number;
}

interface Zombie {
  id: number;
  x: number;
  y: number;
  health: number;
  speed: number;
}

interface Bullet {
  id: number;
  x: number;
  y: number;
  angle: number;
  speed: number;
}

interface Weapon {
  id: number;
  name: string;
  damage: number;
  fireRate: number;
  cost: number;
  icon: string;
}

const WEAPONS: Weapon[] = [
  { id: 1, name: 'PUMP-ACTION', damage: 25, fireRate: 800, cost: 0, icon: '🔫' },
  { id: 2, name: 'COMBAT', damage: 35, fireRate: 600, cost: 100, icon: '💥' },
  { id: 3, name: 'AUTO-SHOTTY', damage: 20, fireRate: 300, cost: 250, icon: '⚡' },
  { id: 4, name: 'DRAGON\'S BREATH', damage: 50, fireRate: 1000, cost: 500, icon: '🔥' }
];

export default function Index() {
  const [gameState, setGameState] = useState<'menu' | 'playing' | 'paused' | 'gameover' | 'shop'>('menu');
  const [player, setPlayer] = useState<Position>({ x: 400, y: 300 });
  const [zombies, setZombies] = useState<Zombie[]>([]);
  const [bullets, setBullets] = useState<Bullet[]>([]);
  const [wave, setWave] = useState(1);
  const [kills, setKills] = useState(0);
  const [coins, setCoins] = useState(0);
  const [health, setHealth] = useState(100);
  const [currentWeapon, setCurrentWeapon] = useState(WEAPONS[0]);
  const [ownedWeapons, setOwnedWeapons] = useState<number[]>([1]);
  const [highScore, setHighScore] = useState(() => {
    return parseInt(localStorage.getItem('zombieShooterHighScore') || '0');
  });

  const canvasRef = useRef<HTMLDivElement>(null);
  const joystickRef = useRef<HTMLDivElement>(null);
  const shootJoystickRef = useRef<HTMLDivElement>(null);
  const [moveJoystick, setMoveJoystick] = useState({ x: 0, y: 0 });
  const [shootJoystick, setShootJoystick] = useState({ x: 0, y: 0 });
  const lastShotTime = useRef(0);
  const { toast } = useToast();

  const handleJoystickMove = useCallback((e: TouchEvent | MouseEvent, isShoot: boolean) => {
    const element = isShoot ? shootJoystickRef.current : joystickRef.current;
    if (!element) return;

    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    let clientX: number, clientY: number;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const deltaX = clientX - centerX;
    const deltaY = clientY - centerY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const maxDistance = 50;

    const normalizedX = distance > maxDistance ? (deltaX / distance) * maxDistance : deltaX;
    const normalizedY = distance > maxDistance ? (deltaY / distance) * maxDistance : deltaY;

    const joystickData = {
      x: normalizedX / maxDistance,
      y: normalizedY / maxDistance
    };

    if (isShoot) {
      setShootJoystick(joystickData);
    } else {
      setMoveJoystick(joystickData);
    }
  }, []);

  useEffect(() => {
    if (gameState !== 'playing') return;

    const gameLoop = setInterval(() => {
      setPlayer((prev) => {
        const newX = Math.max(20, Math.min(780, prev.x + moveJoystick.x * 5));
        const newY = Math.max(20, Math.min(580, prev.y + moveJoystick.y * 5));
        return { x: newX, y: newY };
      });

      if (Math.abs(shootJoystick.x) > 0.1 || Math.abs(shootJoystick.y) > 0.1) {
        const now = Date.now();
        if (now - lastShotTime.current > currentWeapon.fireRate) {
          const angle = Math.atan2(shootJoystick.y, shootJoystick.x);
          setBullets((prev) => [
            ...prev,
            {
              id: Date.now(),
              x: player.x,
              y: player.y,
              angle,
              speed: 10
            }
          ]);
          lastShotTime.current = now;
        }
      }

      setBullets((prev) =>
        prev
          .map((bullet) => ({
            ...bullet,
            x: bullet.x + Math.cos(bullet.angle) * bullet.speed,
            y: bullet.y + Math.sin(bullet.angle) * bullet.speed
          }))
          .filter((bullet) => bullet.x > 0 && bullet.x < 800 && bullet.y > 0 && bullet.y < 600)
      );

      setZombies((prev) =>
        prev.map((zombie) => {
          const dx = player.x - zombie.x;
          const dy = player.y - zombie.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance < 30) {
            setHealth((h) => Math.max(0, h - 1));
          }

          return {
            ...zombie,
            x: zombie.x + (dx / distance) * zombie.speed,
            y: zombie.y + (dy / distance) * zombie.speed
          };
        })
      );

      setBullets((prevBullets) => {
        const remainingBullets = [...prevBullets];
        setZombies((prevZombies) => {
          const newZombies = [...prevZombies];
          let killCount = 0;

          remainingBullets.forEach((bullet, bulletIndex) => {
            newZombies.forEach((zombie, zombieIndex) => {
              const dx = bullet.x - zombie.x;
              const dy = bullet.y - zombie.y;
              const distance = Math.sqrt(dx * dx + dy * dy);

              if (distance < 25) {
                newZombies[zombieIndex] = {
                  ...zombie,
                  health: zombie.health - currentWeapon.damage
                };

                if (newZombies[zombieIndex].health <= 0) {
                  killCount++;
                  setCoins((c) => c + 10);
                }

                remainingBullets.splice(bulletIndex, 1);
              }
            });
          });

          setKills((k) => k + killCount);
          return newZombies.filter((z) => z.health > 0);
        });

        return remainingBullets;
      });

      if (zombies.length === 0 && gameState === 'playing') {
        setGameState('shop');
      }
    }, 1000 / 60);

    return () => clearInterval(gameLoop);
  }, [gameState, moveJoystick, shootJoystick, player, zombies, currentWeapon]);

  useEffect(() => {
    if (health <= 0 && gameState === 'playing') {
      setGameState('gameover');
      if (kills > highScore) {
        setHighScore(kills);
        localStorage.setItem('zombieShooterHighScore', kills.toString());
        toast({
          title: '🏆 NEW RECORD!',
          description: `You set a new high score: ${kills} kills!`
        });
      }
    }
  }, [health, gameState, kills, highScore, toast]);

  const spawnWave = () => {
    const zombieCount = 5 + wave * 3;
    const newZombies: Zombie[] = [];

    for (let i = 0; i < zombieCount; i++) {
      const side = Math.floor(Math.random() * 4);
      let x = 0, y = 0;

      switch (side) {
        case 0: x = Math.random() * 800; y = -20; break;
        case 1: x = 820; y = Math.random() * 600; break;
        case 2: x = Math.random() * 800; y = 620; break;
        case 3: x = -20; y = Math.random() * 600; break;
      }

      newZombies.push({
        id: Date.now() + i,
        x,
        y,
        health: 50 + wave * 10,
        speed: 1 + wave * 0.1
      });
    }

    setZombies(newZombies);
  };

  const startGame = () => {
    setGameState('playing');
    setWave(1);
    setKills(0);
    setCoins(0);
    setHealth(100);
    setPlayer({ x: 400, y: 300 });
    setZombies([]);
    setBullets([]);
    setCurrentWeapon(WEAPONS[0]);
    setOwnedWeapons([1]);
    spawnWave();
  };

  const nextWave = () => {
    setWave((w) => w + 1);
    setHealth((h) => Math.min(100, h + 20));
    setGameState('playing');
    spawnWave();
  };

  const buyWeapon = (weapon: Weapon) => {
    if (coins >= weapon.cost && !ownedWeapons.includes(weapon.id)) {
      setCoins((c) => c - weapon.cost);
      setOwnedWeapons((w) => [...w, weapon.id]);
      setCurrentWeapon(weapon);
      toast({
        title: '✅ WEAPON UNLOCKED!',
        description: `${weapon.name} is now available!`
      });
    }
  };

  const selectWeapon = (weapon: Weapon) => {
    if (ownedWeapons.includes(weapon.id)) {
      setCurrentWeapon(weapon);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1a1a1a] via-[#0d0d0d] to-black flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        {gameState === 'menu' && (
          <Card className="p-8 bg-card border-4 border-primary text-center">
            <h1 className="text-4xl md:text-6xl pixel-text text-primary mb-4 animate-pulse-red">
              ZOMBIE
            </h1>
            <h1 className="text-4xl md:text-6xl pixel-text text-secondary mb-8 animate-pulse-red">
              SHOOTER
            </h1>
            
            <div className="mb-8 space-y-4">
              <div className="flex items-center justify-center gap-4">
                <Icon name="Trophy" className="text-accent" size={32} />
                <p className="text-xl text-accent">HIGH SCORE: {highScore}</p>
              </div>
            </div>

            <Button
              onClick={startGame}
              className="bg-primary hover:bg-primary/80 text-primary-foreground text-2xl py-8 px-12 pixel-border"
            >
              START GAME
            </Button>

            <div className="mt-8 text-left text-sm space-y-2 text-muted-foreground">
              <p>🕹️ USE JOYSTICKS TO MOVE & SHOOT</p>
              <p>💀 SURVIVE ZOMBIE WAVES</p>
              <p>🔫 UNLOCK 4 SHOTGUNS</p>
              <p>🏆 BEAT YOUR HIGH SCORE</p>
            </div>
          </Card>
        )}

        {gameState === 'playing' && (
          <div className="relative">
            <div className="flex justify-between mb-4 gap-2 flex-wrap">
              <Badge className="bg-primary text-primary-foreground text-lg px-4 py-2">
                WAVE {wave}
              </Badge>
              <Badge className="bg-destructive text-destructive-foreground text-lg px-4 py-2">
                HP: {health}
              </Badge>
              <Badge className="bg-secondary text-secondary-foreground text-lg px-4 py-2">
                KILLS: {kills}
              </Badge>
              <Badge className="bg-accent text-accent-foreground text-lg px-4 py-2">
                💰 {coins}
              </Badge>
            </div>

            <div
              ref={canvasRef}
              className="relative w-full aspect-[4/3] bg-gradient-to-br from-[#1a3a1a] to-[#0a1a0a] border-4 border-secondary overflow-hidden"
              style={{ touchAction: 'none' }}
            >
              <div
                className="absolute w-8 h-8 bg-primary rounded-full border-2 border-white"
                style={{
                  left: `${player.x - 16}px`,
                  top: `${player.y - 16}px`,
                  transform: 'translate(0, 0)'
                }}
              />

              {zombies.map((zombie) => (
                <div
                  key={zombie.id}
                  className="absolute w-6 h-6 bg-secondary rounded-full border-2 border-black"
                  style={{
                    left: `${zombie.x - 12}px`,
                    top: `${zombie.y - 12}px`
                  }}
                />
              ))}

              {bullets.map((bullet) => (
                <div
                  key={bullet.id}
                  className="absolute w-2 h-2 bg-accent rounded-full"
                  style={{
                    left: `${bullet.x}px`,
                    top: `${bullet.y}px`
                  }}
                />
              ))}
            </div>

            <div className="flex justify-between mt-4 gap-4">
              <div
                ref={joystickRef}
                className="relative w-32 h-32 bg-card border-4 border-secondary rounded-full flex items-center justify-center"
                onTouchStart={(e) => handleJoystickMove(e.nativeEvent, false)}
                onTouchMove={(e) => handleJoystickMove(e.nativeEvent, false)}
                onTouchEnd={() => setMoveJoystick({ x: 0, y: 0 })}
                onMouseDown={(e) => {
                  const move = (evt: MouseEvent) => handleJoystickMove(evt, false);
                  const up = () => {
                    setMoveJoystick({ x: 0, y: 0 });
                    document.removeEventListener('mousemove', move);
                    document.removeEventListener('mouseup', up);
                  };
                  document.addEventListener('mousemove', move);
                  document.addEventListener('mouseup', up);
                  handleJoystickMove(e.nativeEvent, false);
                }}
              >
                <div
                  className="absolute w-12 h-12 bg-primary rounded-full border-2 border-white"
                  style={{
                    transform: `translate(${moveJoystick.x * 30}px, ${moveJoystick.y * 30}px)`
                  }}
                />
                <span className="text-xs">MOVE</span>
              </div>

              <div className="text-center">
                <p className="text-sm mb-2">{currentWeapon.name}</p>
                <p className="text-2xl">{currentWeapon.icon}</p>
              </div>

              <div
                ref={shootJoystickRef}
                className="relative w-32 h-32 bg-card border-4 border-primary rounded-full flex items-center justify-center"
                onTouchStart={(e) => handleJoystickMove(e.nativeEvent, true)}
                onTouchMove={(e) => handleJoystickMove(e.nativeEvent, true)}
                onTouchEnd={() => setShootJoystick({ x: 0, y: 0 })}
                onMouseDown={(e) => {
                  const move = (evt: MouseEvent) => handleJoystickMove(evt, true);
                  const up = () => {
                    setShootJoystick({ x: 0, y: 0 });
                    document.removeEventListener('mousemove', move);
                    document.removeEventListener('mouseup', up);
                  };
                  document.addEventListener('mousemove', move);
                  document.addEventListener('mouseup', up);
                  handleJoystickMove(e.nativeEvent, true);
                }}
              >
                <div
                  className="absolute w-12 h-12 bg-destructive rounded-full border-2 border-white"
                  style={{
                    transform: `translate(${shootJoystick.x * 30}px, ${shootJoystick.y * 30}px)`
                  }}
                />
                <span className="text-xs">SHOOT</span>
              </div>
            </div>
          </div>
        )}

        {gameState === 'shop' && (
          <Card className="p-8 bg-card border-4 border-accent">
            <h2 className="text-3xl pixel-text text-accent text-center mb-6">
              WEAPON SHOP
            </h2>

            <div className="mb-6 text-center">
              <Badge className="bg-secondary text-secondary-foreground text-xl px-6 py-3">
                WAVE {wave} COMPLETE!
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {WEAPONS.map((weapon) => {
                const owned = ownedWeapons.includes(weapon.id);
                const canBuy = coins >= weapon.cost;

                return (
                  <Card
                    key={weapon.id}
                    className={`p-4 border-2 cursor-pointer transition-all ${
                      currentWeapon.id === weapon.id
                        ? 'border-primary bg-primary/20'
                        : owned
                        ? 'border-secondary hover:border-accent'
                        : canBuy
                        ? 'border-muted hover:border-accent'
                        : 'border-muted opacity-50'
                    }`}
                    onClick={() => owned ? selectWeapon(weapon) : canBuy && buyWeapon(weapon)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-2xl">{weapon.icon}</span>
                      {owned && <Badge className="bg-secondary">OWNED</Badge>}
                    </div>
                    <h3 className="text-lg font-bold mb-2">{weapon.name}</h3>
                    <div className="text-sm space-y-1">
                      <p>DMG: {weapon.damage}</p>
                      <p>FIRE RATE: {(1000 / weapon.fireRate).toFixed(1)}/s</p>
                      {!owned && (
                        <p className="text-accent">
                          COST: {weapon.cost === 0 ? 'FREE' : `💰 ${weapon.cost}`}
                        </p>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>

            <div className="text-center space-y-4">
              <Badge className="bg-accent text-accent-foreground text-xl px-6 py-3">
                💰 {coins} COINS
              </Badge>
              <Button
                onClick={nextWave}
                className="w-full bg-primary hover:bg-primary/80 text-primary-foreground text-xl py-6 pixel-border"
              >
                NEXT WAVE
              </Button>
            </div>
          </Card>
        )}

        {gameState === 'gameover' && (
          <Card className="p-8 bg-card border-4 border-destructive text-center">
            <h2 className="text-4xl pixel-text text-destructive mb-6 animate-shake">
              GAME OVER
            </h2>

            <div className="space-y-4 mb-8">
              <div>
                <p className="text-muted-foreground mb-2">FINAL WAVE</p>
                <p className="text-3xl text-primary">{wave}</p>
              </div>
              <div>
                <p className="text-muted-foreground mb-2">TOTAL KILLS</p>
                <p className="text-3xl text-destructive">{kills}</p>
              </div>
              <div>
                <p className="text-muted-foreground mb-2">HIGH SCORE</p>
                <p className="text-3xl text-accent">{highScore}</p>
              </div>
            </div>

            <Button
              onClick={startGame}
              className="bg-primary hover:bg-primary/80 text-primary-foreground text-xl py-6 px-12 pixel-border"
            >
              PLAY AGAIN
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}

import { useMemo } from 'react';

const CONFIGS = {
  painting:   { items: ['🎨','🖌️','🖍️','🎨','🖌️','🖍️'], anim: 'amb-float'  },
  electrical: { items: ['⚡','💡','⚡','💡','⚡','💡'],   anim: 'amb-flash'  },
  garden:     { items: ['🍃','🌿','🍃','🌸','🌱','🍃'],   anim: 'amb-sway'   },
  tools:      { items: ['⚙️','🔧','⚙️','🔩','🔨','⚙️'], anim: 'amb-spin'   },
  cleaning:   { items: ['🫧','🫧','✨','🫧','🫧','✨'],    anim: 'amb-rise'   },
  plumbing:   { items: ['💧','💧','💦','💧','💧','💦'],   anim: 'amb-drip'   },
  kitchen:    { items: ['🍳','🥄','✨','🍴','✨','🥘'],   anim: 'amb-float'  },
  bathroom:   { items: ['🫧','💧','🫧','🫧','✨','💧'],   anim: 'amb-rise'   },
  adhesives:  { items: ['💧','💧','💧','💧','✨','💧'],   anim: 'amb-drip'   },
  locks:      { items: ['🔑','🗝️','🔐','🔑','🗝️','🔒'], anim: 'amb-float'  },
  faucets:    { items: ['💧','💦','💧','💦','💧','💦'],   anim: 'amb-drip'   },
  home:       { items: ['✨','⭐','✨','✨','⭐','✨'],    anim: 'amb-float'  },
};

const COUNT = 14;

function CategoryAmbience({ categoryId }) {
  const config = CONFIGS[categoryId];

  const particles = useMemo(() => {
    if (!config) return [];
    return Array.from({ length: COUNT }, (_, i) => ({
      emoji:    config.items[i % config.items.length],
      left:     parseFloat((4 + ((i * 7.3 + (i % 3) * 11) % 90)).toFixed(1)),
      top:      parseFloat((8 + ((i * 11.9 + (i % 5) * 7) % 78)).toFixed(1)),
      delay:    parseFloat(((i * 0.61) % 8).toFixed(2)),
      duration: parseFloat((7 + (i * 1.37) % 9).toFixed(2)),
      size:     parseFloat((0.82 + (i * 0.09) % 0.7).toFixed(2)),
    }));
  }, [config]);

  if (!config) return null;

  return (
    <div className="category-ambience" aria-hidden="true">
      {particles.map((p, i) => (
        <span
          key={i}
          className={`amb-particle ${config.anim}`}
          style={{
            left:              `${p.left}%`,
            top:               `${p.top}%`,
            fontSize:          `${p.size}rem`,
            animationDelay:    `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        >
          {p.emoji}
        </span>
      ))}
    </div>
  );
}

export default CategoryAmbience;

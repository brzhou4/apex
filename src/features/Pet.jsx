import { useState } from 'react'
import {
  DEFAULT_PET, petStage, PET_COLORS, PET_UNLOCKS, feedPetOutcome, SHOP_ITEMS,
  IMGS, TIER_COLORS, PET_STAGES,
} from '../game.js'
import { Ic, Field } from '../ui.jsx'

/* ---------------- Pet ---------------- */

// Your grind buddy — with a name you choose, a coat color you pick, and a
// real growth arc: every feeding is pet XP, and enough XP EVOLVES it
// (Pup → Hound → Dire Wolf → War Lion → Apex Dragon). Feedings also roll
// treats and unlock pet-exclusive icons.
export function PetCard({ state, setState, flash }) {
  const pet = state.pet || DEFAULT_PET
  const fruits = state.fruits || 0
  const fed = pet.fed || 0
  const stage = petStage(fed)
  const color = PET_COLORS.find((c) => c.id === pet.color) || PET_COLORS[0]
  const nextUnlock = PET_UNLOCKS.find((u) => u.fed > fed)
  const [munching, setMunching] = useState(false)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(pet.name)

  function feed() {
    if (fruits <= 0) return
    const newFed = fed + 1
    const outcome = feedPetOutcome()
    const unlock = PET_UNLOCKS.find((u) => u.fed === newFed)
    const evolved = petStage(newFed).level > stage.level
    setMunching(true)
    setTimeout(() => setMunching(false), 700)
    setState((s) => {
      const next = { ...s, fruits: Math.max(0, (s.fruits || 0) - 1), pet: { ...(s.pet || DEFAULT_PET), fed: newFed } }
      if (outcome.kind === 'emeralds') next.emeralds = (s.emeralds || 0) + outcome.value
      else if (outcome.kind === 'spin') next.bonusSpins = (s.bonusSpins || 0) + outcome.value
      else if (outcome.kind === 'xpboost') next.xpBoost = outcome.value
      else if (outcome.kind === 'shield') next.shields = (s.shields || 0) + outcome.value
      if (unlock && !(s.ownedIcons || []).includes(unlock.icon)) {
        next.ownedIcons = [...(s.ownedIcons || []), unlock.icon]
      }
      return next
    })
    const unlockItem = unlock && SHOP_ITEMS.find((i) => i.id === unlock.icon)
    if (evolved) {
      const ns = petStage(newFed)
      flash(<><Ic src={ns.img} alt="" size={18} /> {pet.name} EVOLVED into a {ns.name}! (Lv {ns.level})</>)
    } else if (unlockItem) {
      flash(<><Ic src={unlockItem.img} alt="" size={16} /> {pet.name} dug up the {unlockItem.label} icon — pet exclusive!</>)
    } else if (outcome.kind === 'emeralds') {
      flash(<>{pet.name} says thanks! +{outcome.value} <Ic src={IMGS.gem} alt="" size={14} />{outcome.rare ? ' (rare!)' : ''}</>)
    } else if (outcome.kind === 'spin') {
      flash(<>{pet.name} fetched a bonus spin <Ic src={IMGS.slot} alt="" size={14} /></>)
    } else if (outcome.kind === 'xpboost') {
      flash(<>{pet.name} is hyped — {outcome.value}× XP on your next task!</>)
    } else {
      flash(<><Ic src={IMGS.shield} alt="" size={14} /> {pet.name} buried a Streak Recovery for you</>)
    }
  }

  function saveCustomization() {
    setState((s) => ({ ...s, pet: { ...(s.pet || DEFAULT_PET), name: name.trim() || 'Byte' } }))
    setEditing(false)
    flash('Pet updated!')
  }

  return (
    <div className="card pet-card">
      <div className={`pet-avatar ${munching ? 'munch' : ''}`}>
        <img src={stage.img} alt={stage.name} width={64} height={64} style={{ filter: color.filter }} className="ic-img" />
        {munching && (
          <>
            <span className="pet-heart h1">❤️</span>
            <span className="pet-heart h2">🍎</span>
            <span className="pet-heart h3">✨</span>
          </>
        )}
      </div>
      <div className="pet-name">
        {pet.name}
        <span className="pet-level">Lv {stage.level} · {stage.name}</span>
      </div>
      <div className="sub" style={{ textAlign: 'center' }}>
        {fed} pet XP · finish tasks at <b style={{ color: TIER_COLORS.Gold }}>Gold</b> or higher to earn fruit
      </div>

      {stage.next ? (
        <>
          <div className="score-row" style={{ marginTop: 12 }}>
            <span>Evolves into <b>{stage.next.name}</b></span>
            <span>{fed}/{stage.next.fed} XP</span>
          </div>
          <div className="bar"><i style={{ width: `${Math.min(100, (fed / stage.next.fed) * 100)}%`, background: 'var(--mind)' }} /></div>
        </>
      ) : (
        <div className="sub" style={{ textAlign: 'center', marginTop: 10 }}>
          <Ic src={IMGS.crown} alt="👑" size={14} /> Final form reached. {pet.name} is legendary.
        </div>
      )}

      {nextUnlock && (
        <>
          <div className="score-row" style={{ marginTop: 10 }}>
            <span>Next icon: <b>{SHOP_ITEMS.find((i) => i.id === nextUnlock.icon)?.label}</b></span>
            <span>{fed}/{nextUnlock.fed} feedings</span>
          </div>
          <div className="bar"><i style={{ width: `${Math.min(100, (fed / nextUnlock.fed) * 100)}%`, background: 'var(--flame)' }} /></div>
        </>
      )}

      <button className="btn" disabled={fruits <= 0} onClick={feed} style={{ marginTop: 14 }}>
        {fruits > 0
          ? <>Feed {pet.name} — {fruits} <Ic src={IMGS.apple} alt="fruit" size={15} /> left</>
          : <>No fruit yet — go rank up</>}
      </button>

      {!editing ? (
        <button className="btn ghost" onClick={() => { setName(pet.name); setEditing(true) }}>
          <Ic src={IMGS.pencil} alt="✏️" size={14} /> Customize {pet.name}
        </button>
      ) : (
        <div style={{ marginTop: 12, textAlign: 'left' }}>
          <Field label="Pet name">
            <input value={name} maxLength={14} onChange={(e) => setName(e.target.value)} />
          </Field>
          <div className="field-label" style={{ marginTop: 10 }}>Coat color</div>
          <div className="pet-color-row">
            {PET_COLORS.map((c) => (
              <button
                key={c.id}
                className={`pet-color-opt ${pet.color === c.id ? 'on' : ''}`}
                title={c.label}
                onClick={() => setState((s) => ({ ...s, pet: { ...(s.pet || DEFAULT_PET), color: c.id } }))}
              >
                <img src={stage.img} alt={c.label} width={30} height={30} style={{ filter: c.filter }} />
              </button>
            ))}
          </div>
          <button className="btn" onClick={saveCustomization} style={{ marginTop: 12 }}>Save</button>
        </div>
      )}
    </div>
  )
}

// The Pet tab: the pet itself, its evolution ladder, and the icons only it
// can unlock.
export function PetZone({ state, setState, flash }) {
  const fed = state.pet?.fed || 0
  const owned = state.ownedIcons || []

  function equipIcon(id) {
    if (!owned.includes(id)) return
    setState((s) => ({ ...s, equippedIcon: id, avatarImage: null }))
    flash('Icon equipped!')
  }

  return (
    <>
      <PetCard state={state} setState={setState} flash={flash} />

      <div className="card">
        <h3><Ic src={IMGS.chart} alt="📈" size={18} /> Evolution line</h3>
        <div className="evo-row">
          {PET_STAGES.map((s) => {
            const reached = fed >= s.fed
            return (
              <div key={s.level} className={`evo-step ${reached ? 'on' : ''}`} title={`${s.name} · ${s.fed} XP`}>
                <img src={s.img} alt={s.name} width={34} height={34} style={reached ? undefined : { filter: 'grayscale(1) opacity(0.45)' }} />
                <span>Lv {s.level}</span>
              </div>
            )
          })}
        </div>
        <div className="sub" style={{ marginTop: 8 }}>Every feeding = 1 pet XP. Evolutions at {PET_STAGES.slice(1).map((s) => s.fed).join(', ')} XP.</div>
      </div>

      <div className="card">
        <h3><Ic src={IMGS.pet} alt="🐶" size={18} /> Pet-exclusive icons</h3>
        <div className="sub" style={{ marginBottom: 6 }}>Only your pet can dig these up — no emeralds accepted.</div>
        {PET_UNLOCKS.map((u) => {
          const item = SHOP_ITEMS.find((i) => i.id === u.icon)
          const isOwned = owned.includes(u.icon)
          const equipped = state.equippedIcon === u.icon
          return (
            <div className="shop-item" key={u.icon}>
              <div className="shop-item-icon">
                <Ic src={item.img} alt={item.icon || ''} size={30} style={isOwned ? undefined : { filter: 'grayscale(1) opacity(0.4)' }} />
              </div>
              <div className="grow">
                <div className="tt">{item.label}</div>
                <div className="meta">{isOwned ? 'unlocked' : `unlocks at ${u.fed} feedings`}</div>
              </div>
              <button className="btn ghost" disabled={!isOwned || equipped} onClick={() => equipIcon(u.icon)}>
                {equipped ? 'Equipped' : isOwned ? 'Equip' : `${Math.min(fed, u.fed)}/${u.fed}`}
              </button>
            </div>
          )
        })}
      </div>
    </>
  )
}


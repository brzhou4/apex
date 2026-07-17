import { IMGS, SHOP_ITEMS, todayKey } from '../game.js'
import { Ic } from '../ui.jsx'
/* ---------------- Shop ---------------- */

export function Shop({ state, setState, flash }) {
  const ownership = {
    icon: { owned: state.ownedIcons || [], ownedKey: 'ownedIcons', equipped: state.equippedIcon, equipKey: 'equippedIcon' },
    banner: { owned: state.ownedBanners || [], ownedKey: 'ownedBanners', equipped: state.equippedBanner, equipKey: 'equippedBanner' },
    title: { owned: state.ownedTitles || [], ownedKey: 'ownedTitles', equipped: state.equippedTitle, equipKey: 'equippedTitle' },
  }

  function buyOrEquip(item) {
    if (item.type === 'utility') {
      if ((state.emeralds || 0) < item.price) { flash(<>Not enough emeralds <Ic src={IMGS.gem} alt="" size={13} /></>); return }
      if (item.id === 'ut-boost' && (state.xpBoost || 1) > 1) { flash('A boost is already armed — spend it on a task first'); return }
      setState((s) => ({
        ...s,
        emeralds: (s.emeralds || 0) - item.price,
        shields: item.id === 'ut-shield' ? (s.shields || 0) + 1 : s.shields,
        bonusSpins: item.id === 'ut-spin' ? (s.bonusSpins || 0) + 1 : s.bonusSpins,
        xpBoost: item.id === 'ut-boost' ? 2 : s.xpBoost,
      }))
      flash(item.id === 'ut-shield'
        ? <><Ic src={IMGS.shield} alt="" size={15} /> Streak Recovery ready — it auto-saves your next missed day</>
        : item.id === 'ut-spin'
          ? <><Ic src={IMGS.slot} alt="" size={15} /> Bonus spin added — the wheel awaits</>
          : <><Ic src={IMGS.bolt} alt="" size={15} /> 2× XP armed for your next task</>)
      return
    }
    const o = ownership[item.type]
    if (o.owned.includes(item.id)) {
      setState((s) => ({ ...s, [o.equipKey]: s[o.equipKey] === item.id ? (item.type === 'title' ? null : s[o.equipKey]) : item.id }))
      flash(`Equipped ${item.label}`)
      return
    }
    if (item.limited) { flash(<>Spin-exclusive — win it on the Daily Spin <Ic src={IMGS.slot} alt="" size={14} /></>); return }
    if (item.petOnly) { flash(<>Pet-exclusive — keep feeding your pet to dig this one up <Ic src={IMGS.pet} alt="" size={14} /></>); return }
    if ((state.emeralds || 0) < item.price) { flash(<>Not enough emeralds <Ic src={IMGS.gem} alt="" size={13} /></>); return }
    setState((s) => ({
      ...s,
      emeralds: (s.emeralds || 0) - item.price,
      [o.ownedKey]: [...(s[o.ownedKey] || []), item.id],
      [o.equipKey]: item.id,
    }))
    flash(`Unlocked ${item.label}!`)
  }

  function ShopRow({ item }) {
    const o = ownership[item.type]
    const isOwned = o ? o.owned.includes(item.id) : false
    const equipped = o ? o.equipped === item.id : false
    return (
      <div className={`shop-item ${equipped ? 'equipped' : ''}`}>
        <div className="shop-item-icon" style={item.type === 'banner' ? { background: item.gradient, borderRadius: 10 } : undefined}>
          {item.img ? <Ic src={item.img} alt={item.icon || ''} size={30} />
            : item.type === 'icon' ? <Ic src={IMGS.person} alt="" size={26} />
            : item.type === 'title' ? <Ic src={IMGS.crown} alt="🏷️" size={26} /> : ''}
        </div>
        <div className="grow">
          <div className="tt">{item.label}</div>
          <div className="meta">
            <span className="price-emerald">
              {item.limited ? <><Ic src={IMGS.slot} alt="" size={13} /> spin-only</>
                : item.petOnly ? <><Ic src={IMGS.pet} alt="" size={13} /> pet reward</>
                : item.price === 0 ? 'Free' : <><Ic src={IMGS.gem} alt="💎" size={13} /> {item.price}</>}
            </span>
            {item.blurb && <span> · {item.blurb}</span>}
          </div>
        </div>
        <button className="btn ghost" disabled={equipped || ((item.limited || item.petOnly) && !isOwned)} onClick={() => buyOrEquip(item)}>
          {item.type === 'utility' ? 'Buy' : equipped ? 'Equipped' : isOwned ? 'Equip' : (item.limited || item.petOnly) ? 'Locked' : 'Buy'}
        </button>
      </div>
    )
  }

  const section = (type) => SHOP_ITEMS.filter((i) => i.type === type)

  return (
    <>
      <div className="card">
        <h3><Ic src={IMGS.bags} alt="🛍️" size={20} /> Shop</h3>
        <div className="sub">Decorate your screen and profile. Everything runs on <b className="price-emerald"><Ic src={IMGS.gem} alt="💎" size={13} /> emeralds</b> — earn them from every ranked finish, spins, check-ins, and duels.</div>
        <div className="sub" style={{ marginTop: 6 }}>Balance: <span className="price-emerald"><Ic src={IMGS.gem} alt="💎" size={14} /> {state.emeralds || 0}</span></div>
      </div>
      <div className="card">
        <h3><Ic src={IMGS.bolt} alt="⚡" size={20} /> Power-ups</h3>
        <div className="sub" style={{ marginBottom: 4 }}>Shields absorb missed days · spins hit the wheel · boosters double your next task’s XP.</div>
        {section('utility').map((item) => <ShopRow key={item.id} item={item} />)}
        <div className="sub" style={{ marginTop: 6 }}>
          Shields owned: {state.shields || 0} · spins today: {1 + (state.bonusSpins || 0) - (state.spunOn === todayKey() ? state.spinsUsed || 0 : 0)} · boost: {state.xpBoost > 1 ? `${state.xpBoost}× armed` : 'none'}
        </div>
      </div>
      <div className="card">
        <h3>Profile banners</h3>
        {section('banner').map((item) => <ShopRow key={item.id} item={item} />)}
      </div>
      <div className="sub" style={{ marginTop: 12, textAlign: 'center' }}>
        Looking for icons or titles? Icons come from your <b style={{ color: 'var(--text)' }}>Pet</b> · titles are earned on your <b style={{ color: 'var(--text)' }}>Profile</b>.
      </div>
    </>
  )
}


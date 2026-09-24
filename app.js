// MY VIDEO EDITOR - localhost tool
// Covers: upload, preview, play/pause, timeline, trim, volume, duration,
// cut/split, multi-clips, delete, reorder, speed, rotate, resize,
// text/image/music overlays, filters + strength, brightness/contrast, fade,
// scale/position/fit/opacity, mask, keyframes, zoomable timeline + playhead,
// multi audio/text/image timeline clips, effects, stickers, emojis, transitions, mp4 export

const $ = id => document.getElementById(id);
const canvas = $('previewCanvas'), ctx = canvas.getContext('2d');
const video = $('hiddenVideo'), bgAudio = $('bgAudio');
const textLayer = $('textLayer');

let clips = [];             // {id,name,url,duration,trimStart,trimEnd,volume,filter,filterStrength,brightness,contrast,speed,rotate,scale,posX,posY,fit,opacity,mask,maskSize,maskX,maskY,fadeIn,fadeOut,effect,transition,transDur,keyframes:[{id,t,scale,opacity}]}
let selectedClipId = null;
let textOverlays = [];      // {id,text,color,size,x,y,start,end,font,bold,italic,bg,anim}
let selectedTextId = null;
let imageOverlays = [];     // {id,name,url,img,x,y,w,opacity,start,end,anim}
let selectedImageId = null;
let audioClips = [];        // ★ MULTI AUDIO: {id,name,url,duration,start,end,volume,el}
let selectedAudioId = null;
let bgMusicName = null;
let globalTime = 0, playing = false, lastTick = 0, seekDragging = false;
let overlayDragging = false; // pause auto re-render while dragging/resizing overlays on preview
let history = [];
let uid = 1;
let pxPerSec = 120;         // timeline zoom
const FRAME_DUR = 1 / 30;

/* ★ FX catalogues: Filter / Effect / Sticker / Emoji / Transition */
const FILTERS = [
  {v:'none', n:'None'},
  {v:'grayscale(100%)', n:'Grayscale'},
  {v:'sepia(100%)', n:'Sepia'},
  {v:'invert(100%)', n:'Invert'},
  {v:'saturate(200%)', n:'Vivid'},
  {v:'contrast(150%) saturate(130%)', n:'Cinematic'},
  {v:'blur(2px)', n:'Soft Blur'},
  {v:'sepia(60%) contrast(120%)', n:'Vintage'},
  {v:'contrast(130%) brightness(110%) saturate(160%)', n:'Pop'},
  {v:'hue-rotate(90deg) saturate(150%)', n:'Neon Green'},
  {v:'hue-rotate(180deg)', n:'Cyberpunk'},
  {v:'hue-rotate(-40deg) saturate(170%)', n:'Sunset Warm'},
  {v:'brightness(85%) contrast(130%) saturate(40%)', n:'Noir / Cold'},
  {v:'grayscale(60%) contrast(140%) brightness(105%)', n:'B&W Film'},
  {v:'sepia(40%) saturate(160%) hue-rotate(-15deg)', n:'Golden Hour'},
  {v:'saturate(30%) brightness(110%)', n:'Faded / Pastel'},
  {v:'contrast(120%) saturate(0%) brightness(120%)', n:'Silver'},
  {v:'invert(90%) hue-rotate(180deg)', n:'X-Ray'},
  {v:'blur(1px) brightness(110%) saturate(140%)', n:'Dreamy Glow'},
  {v:'contrast(160%) saturate(200%) hue-rotate(10deg)', n:'Punchy'},
];
const EFFECTS = [
  {v:'none', n:'None', d:'No effect'},
  {v:'shake', n:'📳 Shake', d:'Fast shake'},
  {v:'pulse', n:'💓 Pulse', d:'Zoom in-out pulse'},
  {v:'flash', n:'⚡ Flash', d:'Light flicker'},
  {v:'mirror', n:'🪞 Mirror', d:'Horizontal flip'},
  {v:'pop', n:'🎈 Pop', d:'Bounce scale'},
  {v:'slowZoom', n:'🔍 Slow Zoom', d:'Ken Burns zoom in'},
  {v:'slowZoomOut', n:'🔍 Zoom Out', d:'Slow zoom out'},
  {v:'driftL', n:'➡ Drift', d:'Gentle side pan'},
  {v:'floatY', n:'🎈 Float', d:'Gentle up-down float'},
  {v:'wiggle', n:'〰 Wiggle', d:'Small rotation wiggle'},
  {v:'sway', n:'🎠 Sway', d:'Rotate + pan sway'},
  {v:'breathe', n:'😮‍💨 Breathe', d:'Soft opacity breathing'},
  {v:'blink', n:'👁 Blink', d:'Soft blink fade'},
  {v:'spinSlow', n:'🌀 Slow Spin', d:'Slow continuous tilt'},
  {v:'hueCycle', n:'🌈 Hue Cycle', d:'Color cycle shift'},
  {v:'satPulse', n:'🎨 Color Pulse', d:'Saturation pulse'},
  {v:'glitchLoop', n:'📺 Glitch Loop', d:'Repeating glitch'},
  {v:'strobeLoop', n:'⚡ Strobe Loop', d:'Party strobe flash'},
  {v:'bounceLoop', n:'🏀 Bounce Loop', d:'Bouncy up-down'},
  {v:'heartbeatLoop', n:'💓 Heartbeat', d:'Heartbeat zoom'},
  {v:'jitter', n:'📳 Jitter', d:'Tiny fast jitter'},
  {v:'vintageFlicker', n:'🎞 Film Flicker', d:'Old-film flicker'},
];
/* Clip transitions (IN at clip start, OUT at clip end into the next clip) */
const TRANSITIONS = [
  // Fade (8)
  {v:'fade', n:'🌫 Fade In', cat:'Fade'},
  {v:'fadeZoom', n:'🌫🔍 Fade + Zoom', cat:'Fade'},
  {v:'fadeSlideL', n:'🌫⬅ Fade + Slide L', cat:'Fade'},
  {v:'fadeSlideR', n:'🌫➡ Fade + Slide R', cat:'Fade'},
  {v:'fadeSlideU', n:'🌫⬆ Fade + Rise', cat:'Fade'},
  {v:'fadeSlideD', n:'🌫⬇ Fade + Drop', cat:'Fade'},
  {v:'fadeSpin', n:'🌫🌀 Fade + Spin', cat:'Fade'},
  {v:'fadeBlur', n:'🌫💧 Fade + Blur', cat:'Fade'},
  // Slide (8)
  {v:'slideL', n:'⬅ Slide Left', cat:'Slide'},
  {v:'slideR', n:'➡ Slide Right', cat:'Slide'},
  {v:'slideU', n:'⬆ Slide Up', cat:'Slide'},
  {v:'slideD', n:'⬇ Slide Down', cat:'Slide'},
  {v:'slideTL', n:'↖ Slide Top-Left', cat:'Slide'},
  {v:'slideTR', n:'↗ Slide Top-Right', cat:'Slide'},
  {v:'slideBL', n:'↙ Slide Bottom-Left', cat:'Slide'},
  {v:'slideBR', n:'↘ Slide Bottom-Right', cat:'Slide'},
  // Zoom (6)
  {v:'zoom', n:'🔍 Zoom In', cat:'Zoom'},
  {v:'zoomOut', n:'🔍 Zoom Out', cat:'Zoom'},
  {v:'zoomBounce', n:'🔍 Bounce Zoom', cat:'Zoom'},
  {v:'zoomSpin', n:'🔍🌀 Zoom Spin', cat:'Zoom'},
  {v:'zoomSlideU', n:'🔍⬆ Zoom Rise', cat:'Zoom'},
  {v:'zoomFlash', n:'🔍⚪ Zoom Flash', cat:'Zoom'},
  // Spin (4)
  {v:'spinCW', n:'🌀 Spin Right', cat:'Spin'},
  {v:'spinCCW', n:'🌀 Spin Left', cat:'Spin'},
  {v:'spinBlur', n:'🌀💧 Spin Blur', cat:'Spin'},
  {v:'spinFade', n:'🌀🌫 Spin Fade', cat:'Spin'},
  // Flip (3)
  {v:'flipH', n:'🔄 Flip Horizontal', cat:'Flip'},
  {v:'flipV', n:'🔄 Flip Vertical', cat:'Flip'},
  {v:'flipFade', n:'🔄🌫 Flip Fade', cat:'Flip'},
  // Wipe (4)
  {v:'wipeL', n:'▬ Wipe from Left', cat:'Wipe'},
  {v:'wipeR', n:'▬ Wipe from Right', cat:'Wipe'},
  {v:'wipeU', n:'▬ Wipe from Top', cat:'Wipe'},
  {v:'wipeD', n:'▬ Wipe from Bottom', cat:'Wipe'},
  // Shape (3)
  {v:'irisIn', n:'⭕ Iris In', cat:'Shape'},
  {v:'circlePop', n:'⭕ Circle Pop', cat:'Shape'},
  {v:'squareIn', n:'◻ Square In', cat:'Shape'},
  // Bounce (4)
  {v:'bounceIn', n:'🏀 Bounce In', cat:'Bounce'},
  {v:'elasticIn', n:'〰 Elastic In', cat:'Bounce'},
  {v:'dropIn', n:'⬇ Drop Bounce', cat:'Bounce'},
  {v:'popIn', n:'🎈 Pop In', cat:'Bounce'},
  // Blur / Glow (3)
  {v:'blurIn', n:'💧 Blur In', cat:'Blur'},
  {v:'glowIn', n:'✨ Glow In', cat:'Blur'},
  {v:'softIn', n:'☁ Soft In', cat:'Blur'},
  // Flash / Glitch (6)
  {v:'white', n:'⚪ White Flash', cat:'Flash'},
  {v:'black', n:'⚫ Black Fade', cat:'Flash'},
  {v:'strobe', n:'⚡ Strobe', cat:'Flash'},
  {v:'glitch', n:'📺 Glitch', cat:'Flash'},
  {v:'shakeIn', n:'📳 Shake In', cat:'Flash'},
  {v:'flicker', n:'💡 Flicker', cat:'Flash'},
  // Cinematic (4)
  {v:'mirrorL', n:'🪞 Mirror Slide L', cat:'Cine'},
  {v:'mirrorR', n:'🪞 Mirror Slide R', cat:'Cine'},
  {v:'rollIn', n:'🎡 Roll In', cat:'Cine'},
  {v:'swingIn', n:'🎠 Swing In', cat:'Cine'},
  // Extra (2)
  {v:'heartbeat', n:'💓 Heartbeat', cat:'Extra'},
  {v:'floatUp', n:'🎈 Float Up', cat:'Extra'},
  // Fade extra (4)
  {v:'fadeZoomOut', n:'🌫🔍 Fade + Zoom Out', cat:'Fade'},
  {v:'fadeFlip', n:'🌫🔄 Fade + Flip', cat:'Fade'},
  {v:'fadeBounce', n:'🌫🏀 Fade + Bounce', cat:'Fade'},
  {v:'fadeGlow', n:'🌫✨ Fade + Glow', cat:'Fade'},
  // Slide extra (4)
  {v:'slideBounceL', n:'⬅ Bounce Slide L', cat:'Slide'},
  {v:'slideBounceR', n:'➡ Bounce Slide R', cat:'Slide'},
  {v:'slideElasticU', n:'⬆ Elastic Rise', cat:'Slide'},
  {v:'slideSpin', n:'↖ Slide + Spin', cat:'Slide'},
  // Zoom extra (4)
  {v:'crashZoom', n:'💥 Crash Zoom', cat:'Zoom'},
  {v:'zoomPanL', n:'🔍⬅ Zoom Pan L', cat:'Zoom'},
  {v:'zoomPanR', n:'🔍➡ Zoom Pan R', cat:'Zoom'},
  {v:'zoomOutSpin', n:'🔍🌀 Zoom Out Spin', cat:'Zoom'},
  // Spin extra (2)
  {v:'tiltSpin', n:'🎡 Tilt Spin', cat:'Spin'},
  {v:'spinZoomOut', n:'🌀🔍 Spin Zoom Out', cat:'Spin'},
  // Flip extra (2)
  {v:'flipSpin', n:'🔄🌀 Flip Spin', cat:'Flip'},
  {v:'flipBounce', n:'🔄🏀 Flip Bounce', cat:'Flip'},
  // Wipe extra (4)
  {v:'wipeCenter', n:'▬ Wipe Center', cat:'Wipe'},
  {v:'wipeDiagTL', n:'◣ Wipe Diagonal', cat:'Wipe'},
  {v:'wipeDiagBR', n:'◢ Wipe Diagonal 2', cat:'Wipe'},
  {v:'wipeBounce', n:'▬ Bounce Wipe', cat:'Wipe'},
  // Shape extra (2)
  {v:'diamondIn', n:'◆ Diamond In', cat:'Shape'},
  {v:'barReveal', n:'▬ Bar Reveal', cat:'Shape'},
  // Bounce extra (2)
  {v:'jellyIn', n:'🍮 Jelly In', cat:'Bounce'},
  {v:'swingDrop', n:'🎠 Swing Drop', cat:'Bounce'},
  // Blur / Glow extra (2)
  {v:'pixelIn', n:'🧱 Pixel In', cat:'Blur'},
  {v:'focusPull', n:'📷 Focus Pull', cat:'Blur'},
  // Flash / Glitch extra (4)
  {v:'lightLeak', n:'🔥 Light Leak', cat:'Flash'},
  {v:'lensFlash', n:'📸 Lens Flash', cat:'Flash'},
  {v:'rgbSplit', n:'👾 RGB Split', cat:'Flash'},
  {v:'neonFlicker', n:'💡 Neon Flicker', cat:'Flash'},
  // Cinematic extra (4)
  {v:'dollyIn', n:'🎥 Dolly In', cat:'Cine'},
  {v:'panLeft', n:'⬅ Cinematic Pan', cat:'Cine'},
  {v:'panRight', n:'➡ Cinematic Pan', cat:'Cine'},
  {v:'filmFlicker', n:'🎞 Film Flicker', cat:'Cine'},
  // Extra (3)
  {v:'swirlIn', n:'🌀 Swirl In', cat:'Extra'},
  {v:'rippleIn', n:'🌊 Ripple In', cat:'Extra'},
  {v:'tornadoSpin', n:'🌪 Tornado Spin', cat:'Extra'},
];
const transName = v => v==='none'?'None':(TRANSITIONS.find(t=>t.v===v)||{n:v}).n;
/* easing helpers for bounce / elastic / pop transitions */
const easeOutBounce = p => { const n=7.5625,d=2.75; if(p<1/d)return n*p*p; if(p<2/d)return n*(p-=1.5/d)*p+.75; if(p<2.5/d)return n*(p-=2.25/d)*p+.9375; return n*(p-=2.625/d)*p+.984375; };
const easeOutElastic = p => p<=0?0:p>=1?1:Math.pow(2,-10*p)*Math.sin((p*10-0.75)*(2*Math.PI/3))+1;
const easeOutBack = p => { const c=1.70158; return 1+(c+1)*Math.pow(p-1,3)+c*Math.pow(p-1,2); };
const STICKERS = ['⭐','🔥','❤️','👍','🎉','💥','✨','🌟','💯','😎','🎈','🎁','⚡','🌈','👑','💎','🏆','🚀','🎵','⚽','🍕','💰','✅','❌','‼️','💤','🎯','🧨','🫧','🌸',
'🥳','🤩','😍','🤣','😂','🥰','😜','🤪','😇','🥺','😱','🤯','🥶','🤠','👻','🤖','🦄','🐼','🐱','🐶','🦁','🐯','🐸','🐵','🐙','🦋','🌹','🌻','🍀','🍎','🍔','🍩','🍦','⚽','🏀','🏏','🎮','🎧','🎬','📢','💡','🔔','🎊','🎀','💄','👒','🕶️','🧢','👟','🎒','📱','💻','⌚','📸','🎸','🥁','⚾','🎳','🏸','🥊','🛹','🚗','✈️','🚁','⛵','🏝️','⛰️','❄️','☃️','🎃','🎄','🧨','🎇','💧','🌊','🌪️','🌈','☀️','🌙','🪐','💫','🪩','🎭','🎪','🏅','🥇','💸','🤑','💵','🪙','🔒','🔑','🧸','🪆','🎠','🎢','🃏','🎲','🧩','📚','✏️','📌','❓','❗','💢','💬','🗯️','💭','👀','🙌','👏','💪','🙏','🤝','💅','👋','✌️','🤞','🫶','❤️‍🔥','💘','💝','🥀','🤍','🖤'];
const EMOJIS = ['😀','😁','😂','🤣','😊','😍','😎','🤩','😜','🤔','😴','😭','😡','👍','👎','🙏','👏','💪','🙌','👀','🔥','❤️','💔','💯','✨','🎉','🎊','💥','🌟','⭐','🍕','🍔','⚽','🏏','🎵','🎧','🚀','🌈','☀️','🌙','🐱','🐶','🦁','🌸','🌹','🍀','⚡','💎','👑','🏆','🎁','🎈','🧠','👻','🤖','🦄','🐼','❓','‼️','💤',
'🥳','🥰','🤪','😇','🥺','😱','🤯','🥶','🤠','😴','🤤','😷','🤒','🤕','😈','👿','💀','☠️','👽','🎃','😺','😸','😹','😻','🙈','🙉','🙊','🐵','🐶','🐱','🦁','🐯','🐸','🐙','🦋','🐝','🐞','🌹','🌻','🌷','🍎','🍊','🍇','🍩','🍦','🍫','🍿','🥤','⚽','🏀','⚾','🎾','🏸','🎮','🕹️','🎲','🎯','🎳','🚗','✈️','🚀','🛸','⛵','🏝️','⛰️','❄️','☃️','🌊','🌪️','🪐','💫','🎭','🎪','🏅','🥇','🥈','🥉','💸','💵','🔒','🔑','🧸','🎠','📚','✏️','📌','💢','💬','🗯️','💭','👋','✌️','🤞','🫶','❤️‍🔥','💘','🤍','🖤','💙','💚','💛','🧡','💜','🤎','❣️','💕','💞','🙈','🙉'];
/* ★ YouTube-related sticker pack (buttons + emoji) — now animated */
const YT_STICKERS = [
  {t:'▶ SUBSCRIBE', bg:'#ff0000', color:'#ffffff', size:54, anim:'pulse'},
  {t:'🔔 BELL ON', bg:'#222222', color:'#ffffff', size:48, anim:'swing'},
  {t:'👍 LIKE', bg:'#065fd4', color:'#ffffff', size:54, anim:'heartbeat'},
  {t:'💬 COMMENT', bg:'#222222', color:'#ffffff', size:44, anim:'float'},
  {t:'↗ SHARE', bg:'#2e9b4e', color:'#ffffff', size:48, anim:'slideLoop'},
  {t:'🔴 LIVE', bg:'#ff0000', color:'#ffffff', size:60, anim:'flicker'},
  {t:'📺 NEW VIDEO', bg:'#ff0000', color:'#ffffff', size:44, anim:'popLoop'},
  {t:'✅ SUBSCRIBED', bg:'#333333', color:'#7dff9b', size:44, anim:'glow'},
  {t:'🔥 TRENDING', bg:'#ff5500', color:'#ffffff', size:48, anim:'flicker'},
  {t:'🎬 WATCH NOW', bg:'#065fd4', color:'#ffffff', size:44, anim:'pulse'},
  {t:'💯 100K!', bg:'#7c5cff', color:'#ffffff', size:54, anim:'tada'},
  {t:'👑 NEW VLOG', bg:'#b8860b', color:'#ffffff', size:44, anim:'float'},
];
const YT_EMOJIS = ['▶️','📺','🔔','👍','👎','🔴','💬','↗️','🎬','📢','❤️','🔥','⏯️','⏭️','🔊','📈','💯','🏆'];
/* ★ MAX ANIMATED STICKERS: emoji + pre-set loop animation (preview CSS + export canvas) */
const ANIMATED_STICKERS = [
  {t:'🔥', anim:'flicker', size:84, n:'Fire Flicker'},
  {t:'❤️', anim:'heartbeat', size:84, n:'Love Beat'},
  {t:'💔', anim:'shake', size:80, n:'Heartbreak'},
  {t:'💯', anim:'glow', size:84, n:'100 Glow'},
  {t:'✨', anim:'glow', size:80, n:'Sparkle Glow'},
  {t:'🌟', anim:'spin', size:80, n:'Star Spin'},
  {t:'⭐', anim:'pulse', size:80, n:'Star Pulse'},
  {t:'🎉', anim:'bounce', size:84, n:'Party Bounce'},
  {t:'🎊', anim:'bounceBig', size:84, n:'Party Big'},
  {t:'💥', anim:'popSpin', size:84, n:'Boom Spin'},
  {t:'⚡', anim:'storm', size:84, n:'Storm'},
  {t:'🌈', anim:'wave', size:84, n:'Rainbow Wave'},
  {t:'👑', anim:'float', size:84, n:'Crown Float'},
  {t:'💎', anim:'glow', size:80, n:'Diamond Glow'},
  {t:'🏆', anim:'bounce', size:84, n:'Trophy Bounce'},
  {t:'🚀', anim:'float', size:84, n:'Rocket Float'},
  {t:'🎵', anim:'wave', size:80, n:'Music Wave'},
  {t:'🎧', anim:'swing', size:80, n:'Music Swing'},
  {t:'⚽', anim:'bounceBig', size:84, n:'Football'},
  {t:'🏀', anim:'bounceBig', size:84, n:'Basketball'},
  {t:'🏏', anim:'bounce', size:80, n:'Cricket'},
  {t:'🎮', anim:'wobble', size:80, n:'Gaming'},
  {t:'🍕', anim:'tilt', size:80, n:'Pizza Tilt'},
  {t:'🍔', anim:'tilt', size:80, n:'Burger Tilt'},
  {t:'🍩', anim:'spin', size:80, n:'Donut Spin'},
  {t:'💰', anim:'zoomPulse', size:84, n:'Money Pulse'},
  {t:'💸', anim:'slideUD', size:80, n:'Cash Fall'},
  {t:'🤑', anim:'zoomPulse', size:84, n:'Rich Pulse'},
  {t:'✅', anim:'popLoop', size:80, n:'Check Pop'},
  {t:'❌', anim:'shake', size:80, n:'Cross Shake'},
  {t:'‼️', anim:'shake', size:80, n:'Alert Shake'},
  {t:'❓', anim:'bounce', size:80, n:'Question'},
  {t:'💤', anim:'float', size:80, n:'Sleep Float'},
  {t:'🎯', anim:'pulse', size:80, n:'Target Pulse'},
  {t:'🧨', anim:'storm', size:80, n:'Cracker'},
  {t:'🎇', anim:'flicker', size:80, n:'Spark Flicker'},
  {t:'🫧', anim:'float', size:80, n:'Bubble Float'},
  {t:'🌸', anim:'wave', size:76, n:'Flower Wave'},
  {t:'🌹', anim:'float', size:80, n:'Rose Float'},
  {t:'🍀', anim:'wave', size:80, n:'Lucky Wave'},
  {t:'😂', anim:'jump', size:84, n:'Laugh Jump'},
  {t:'🤣', anim:'jump', size:84, n:'ROFL Jump'},
  {t:'😍', anim:'heartbeat', size:84, n:'Crush Beat'},
  {t:'🥰', anim:'heartbeat', size:84, n:'Love Glow'},
  {t:'😎', anim:'tilt', size:84, n:'Cool Tilt'},
  {t:'🤩', anim:'glow', size:84, n:'Star Eyes'},
  {t:'🥳', anim:'bounceBig', size:84, n:'Celebrate'},
  {t:'😜', anim:'wobble', size:80, n:'Wink Wobble'},
  {t:'🤪', anim:'wobble', size:80, n:'Crazy Wobble'},
  {t:'😱', anim:'storm', size:84, n:'Shock Storm'},
  {t:'🤯', anim:'popSpin', size:84, n:'Mindblow'},
  {t:'😡', anim:'storm', size:84, n:'Angry Storm'},
  {t:'😭', anim:'shake', size:80, n:'Cry Shake'},
  {t:'🥶', anim:'shake', size:80, n:'Cold Shake'},
  {t:'👍', anim:'pulse', size:84, n:'Like Pulse'},
  {t:'👎', anim:'tilt', size:80, n:'Dislike Tilt'},
  {t:'🙏', anim:'float', size:80, n:'Pray Float'},
  {t:'👏', anim:'bounce', size:84, n:'Clap Bounce'},
  {t:'💪', anim:'popLoop', size:84, n:'Strong Pop'},
  {t:'🙌', anim:'bounceBig', size:84, n:'Hooray'},
  {t:'👀', anim:'blink', size:80, n:'Eyes Blink'},
  {t:'🔔', anim:'swing', size:84, n:'Bell Swing'},
  {t:'📢', anim:'shake', size:80, n:'Shout Shake'},
  {t:'🎬', anim:'flicker', size:80, n:'Action Flicker'},
  {t:'💡', anim:'flicker', size:80, n:'Idea Bulb'},
  {t:'☀️', anim:'spin', size:84, n:'Sun Spin'},
  {t:'🌙', anim:'float', size:80, n:'Moon Float'},
  {t:'❄️', anim:'float', size:80, n:'Snow Float'},
  {t:'🌊', anim:'wave', size:84, n:'Wave'},
  {t:'🌪️', anim:'storm', size:84, n:'Tornado'},
  {t:'🪐', anim:'float', size:84, n:'Planet Float'},
  {t:'💫', anim:'spinFast', size:80, n:'Dizzy Fast'},
  {t:'🌀', anim:'spinFast', size:84, n:'Swirl Fast'},
  {t:'🐱', anim:'jump', size:80, n:'Cat Jump'},
  {t:'🐶', anim:'jump', size:80, n:'Dog Jump'},
  {t:'🦁', anim:'storm', size:84, n:'Lion Roar'},
  {t:'🐼', anim:'tilt', size:80, n:'Panda Tilt'},
  {t:'👻', anim:'float', size:84, n:'Ghost Float'},
  {t:'🤖', anim:'wobble', size:80, n:'Robot Wobble'},
  {t:'🦄', anim:'wave', size:84, n:'Unicorn Wave'},
  {t:'🧠', anim:'pulse', size:80, n:'Brain Pulse'},
  {t:'🎁', anim:'bounce', size:84, n:'Gift Bounce'},
  {t:'🎈', anim:'float', size:84, n:'Balloon Float'},
  {t:'🎃', anim:'bounce', size:80, n:'Pumpkin'},
  {t:'🎄', anim:'glow', size:80, n:'Tree Glow'},
  {t:'💠', anim:'neon', size:84, n:'Neon Glow'},
  {t:'🎆', anim:'flicker', size:84, n:'Fireworks'},
  {t:'🏅', anim:'tada', size:80, n:'Medal Tada'},
  {t:'🥇', anim:'tada', size:84, n:'Gold Tada'},
  {t:'📱', anim:'shake', size:76, n:'Phone Shake'},
  {t:'💭', anim:'float', size:76, n:'Thought Float'},
  {t:'💬', anim:'popLoop', size:76, n:'Chat Pop'},
  {t:'🔔🔥', anim:'swing', size:72, n:'Bell Fire'},
  {t:'❤️‍🔥', anim:'heartbeat', size:84, n:'Burning Love'},
  {t:'🫶', anim:'heartbeat', size:80, n:'Hearts Beat'},
  /* ★ COMBO emoji (double = dhamaka look) */
  {t:'🔥🔥', anim:'storm', size:80, n:'Double Fire'},
  {t:'❤️❤️', anim:'heartbeat', size:80, n:'Double Love'},
  {t:'🎉🎊', anim:'bounceBig', size:80, n:'Party Combo'},
  {t:'💥💥', anim:'popSpin', size:80, n:'Double Boom'},
  {t:'⭐🌟', anim:'glow', size:80, n:'Stars Glow'},
  {t:'🤑💰', anim:'zoomPulse', size:80, n:'Money Combo'},
  {t:'😂🤣', anim:'jump', size:80, n:'Laugh Combo'},
  {t:'🥳🎉', anim:'bounceBig', size:80, n:'Celebrate Combo'},
  {t:'👏👏', anim:'bounce', size:80, n:'Claps'},
  {t:'🙌🎉', anim:'bounceBig', size:80, n:'Hooray Combo'},
  {t:'⚽🏆', anim:'bounceBig', size:80, n:'Champion'},
  {t:'🏏🔥', anim:'flicker', size:80, n:'Cricket Fire'},
  {t:'🎮🔥', anim:'flicker', size:80, n:'Gaming Fire'},
  {t:'🎵🎶', anim:'wave', size:80, n:'Music Combo'},
  {t:'🌈✨', anim:'glow', size:80, n:'Rainbow Sparkle'},
  {t:'👑💎', anim:'glow', size:80, n:'Royal Combo'},
  {t:'🚀🌙', anim:'float', size:80, n:'Space Trip'},
  {t:'🐱🐶', anim:'jump', size:80, n:'Pets Jump'},
  {t:'🦁🔥', anim:'storm', size:80, n:'Lion Fire'},
  {t:'👻🎃', anim:'float', size:80, n:'Spooky Combo'},
  {t:'🤖🚀', anim:'wobble', size:80, n:'Robo Space'},
  {t:'🦄🌈', anim:'wave', size:80, n:'Unicorn Rainbow'},
  {t:'❄️☃️', anim:'float', size:80, n:'Winter Combo'},
  {t:'🌸🌺', anim:'wave', size:76, n:'Flowers'},
  {t:'🍀💰', anim:'zoomPulse', size:80, n:'Lucky Money'},
  {t:'💡✨', anim:'flicker', size:80, n:'Idea Sparkle'},
  {t:'📢🔥', anim:'shake', size:80, n:'Loud Fire'},
  {t:'🎬🍿', anim:'flicker', size:80, n:'Movie Time'},
  {t:'🍕🍔', anim:'tilt', size:80, n:'Food Combo'},
  {t:'🏆🥇', anim:'tada', size:80, n:'Winner Combo'},
  /* ★ TEXT BANNERS (with bg color — YouTube/promo style) */
  {t:'WOW!', anim:'tada', size:64, n:'WOW Tada', bg:'#ff8800', color:'#ffffff', bold:true},
  {t:'OMG!', anim:'storm', size:64, n:'OMG Storm', bg:'#ff0000', color:'#ffffff', bold:true},
  {t:'SUPER!', anim:'zoomPulse', size:60, n:'Super Pulse', bg:'#065fd4', color:'#ffffff', bold:true},
  {t:'HIT!', anim:'bounceBig', size:64, n:'Hit Bounce', bg:'#2e9b4e', color:'#ffffff', bold:true},
  {t:'LOL!', anim:'jump', size:64, n:'LOL Jump', bg:'#ff5500', color:'#ffffff', bold:true},
  {t:'COOL!', anim:'tilt', size:60, n:'Cool Tilt', bg:'#00acc1', color:'#ffffff', bold:true},
  {t:'HOT!', anim:'flicker', size:64, n:'Hot Flicker', bg:'#e53935', color:'#ffff00', bold:true},
  {t:'NEW!', anim:'popLoop', size:64, n:'New Pop', bg:'#7c5cff', color:'#ffffff', bold:true},
  {t:'SALE!', anim:'blink', size:64, n:'Sale Blink', bg:'#ff0000', color:'#ffff00', bold:true},
  {t:'50% OFF!', anim:'blink', size:52, n:'50 Off Blink', bg:'#ff0000', color:'#ffffff', bold:true},
  {t:'HAPPY BIRTHDAY!', anim:'bounceBig', size:44, n:'Birthday Bounce', bg:'#d81b60', color:'#ffffff', bold:true},
  {t:'CONGRATS!', anim:'tada', size:54, n:'Congrats Tada', bg:'#2e9b4e', color:'#ffffff', bold:true},
  {t:'WELCOME!', anim:'wave', size:54, n:'Welcome Wave', bg:'#065fd4', color:'#ffffff', bold:true},
  {t:'THANK YOU!', anim:'float', size:50, n:'Thanks Float', bg:'#00897b', color:'#ffffff', bold:true},
  {t:'LOVE YOU!', anim:'heartbeat', size:54, n:'Love You Beat', bg:'#e91e63', color:'#ffffff', bold:true},
  {t:'MISS YOU!', anim:'heartbeat', size:54, n:'Miss You Beat', bg:'#5c6bc0', color:'#ffffff', bold:true},
  {t:'FOLLOW ME!', anim:'pulse', size:50, n:'Follow Pulse', bg:'#065fd4', color:'#ffffff', bold:true},
  {t:'LIKE KARO!', anim:'pulse', size:52, n:'Like Karo', bg:'#065fd4', color:'#ffffff', bold:true},
  {t:'SUBSCRIBE KARO!', anim:'pulse', size:44, n:'Subscribe Karo', bg:'#ff0000', color:'#ffffff', bold:true},
  {t:'BELL DABAO! 🔔', anim:'swing', size:44, n:'Bell Dabao', bg:'#222222', color:'#ffffff', bold:true},
  {t:'COMMENT KARO!', anim:'popLoop', size:48, n:'Comment Karo', bg:'#455a64', color:'#ffffff', bold:true},
  {t:'SHARE KARO! ↗', anim:'slideLoop', size:48, n:'Share Karo', bg:'#2e9b4e', color:'#ffffff', bold:true},
  {t:'LIVE AAO! 🔴', anim:'flicker', size:48, n:'Live Aao', bg:'#ff0000', color:'#ffffff', bold:true},
  {t:'VIRAL! 🚀', anim:'storm', size:54, n:'Viral Storm', bg:'#ff5500', color:'#ffffff', bold:true},
  {t:'GOOD MORNING! ☀️', anim:'float', size:42, n:'Good Morning', bg:'#ffa000', color:'#ffffff', bold:true},
  {t:'GOOD NIGHT! 🌙', anim:'float', size:42, n:'Good Night', bg:'#283593', color:'#ffffff', bold:true},
  /* ★ HINDI / HINGLISH dhamaka */
  {t:'धमाका! 💥', anim:'popSpin', size:52, n:'Dhamaka', bg:'#ff5500', color:'#ffffff', bold:true},
  {t:'शाबाश! 👏', anim:'tada', size:52, n:'Shabash', bg:'#2e9b4e', color:'#ffffff', bold:true},
  {t:'बधाई हो! 🎉', anim:'bounceBig', size:46, n:'Badhai', bg:'#d81b60', color:'#ffffff', bold:true},
  {t:'शुभ दीपावली! 🪔', anim:'glow', size:42, n:'Deepavali', bg:'#b8860b', color:'#ffffff', bold:true},
  {t:'होली है! 🎨', anim:'wave', size:50, n:'Holi', bg:'#8e24aa', color:'#ffffff', bold:true},
  {t:'जय श्री राम! 🚩', anim:'glow', size:44, n:'Jai Shri Ram', bg:'#ef6c00', color:'#ffffff', bold:true},
  {t:'राधे राधे! 🦚', anim:'float', size:46, n:'Radhe Radhe', bg:'#1565c0', color:'#ffffff', bold:true},
  {t:'ईद मुबारक! 🌙', anim:'glow', size:44, n:'Eid Mubarak', bg:'#2e7d32', color:'#ffffff', bold:true},
  {t:'गणपति बाप्पा! 🙏', anim:'bounce', size:42, n:'Ganpati', bg:'#c62828', color:'#ffffff', bold:true},
  {t:'वाह! 😍', anim:'jump', size:56, n:'Wah', bg:'#00897b', color:'#ffffff', bold:true},
  {t:'क्या बात! 👌', anim:'tada', size:50, n:'Kya Baat', bg:'#6a1b9a', color:'#ffffff', bold:true},
  {t:'झक्कास! 🤩', anim:'zoomPulse', size:52, n:'Jhakkas', bg:'#ad1457', color:'#ffffff', bold:true},
  {t:'एक नंबर! 🥇', anim:'popLoop', size:50, n:'Ek Number', bg:'#f9a825', color:'#000000', bold:true},
  {t:'लय भारी! 🔥', anim:'bounce', size:50, n:'Lay Bhari', bg:'#e65100', color:'#ffffff', bold:true},
  {t:'धमाल! 🎊', anim:'popSpin', size:54, n:'Dhamal', bg:'#6a1b9a', color:'#ffffff', bold:true},
];
/* Text / sticker animations (preview CSS + export canvas) — MAX pack */
const TEXT_ANIMS = [
  {v:'none', n:'None'},
  {v:'fade', n:'Fade In'},
  {v:'slideL', n:'Slide from Left'},
  {v:'slideR', n:'Slide from Right'},
  {v:'slideLoop', n:'Slide Loop'},
  {v:'up', n:'Rise Up'},
  {v:'drop', n:'Drop From Top'},
  {v:'zoom', n:'Zoom In'},
  {v:'zoomOut', n:'Zoom Out Entry'},
  {v:'zoomBounce', n:'Zoom Bounce Entry'},
  {v:'flip', n:'Flip In'},
  {v:'spinIn', n:'Spin In Entry'},
  {v:'riseFade', n:'Rise + Fade'},
  {v:'blurIn', n:'Blur In'},
  {v:'bounce', n:'Bounce (loop)'},
  {v:'pulse', n:'Pulse (loop)'},
  {v:'popLoop', n:'Pop (loop)'},
  {v:'spin', n:'Spin (loop)'},
  {v:'wave', n:'Wave (loop)'},
  {v:'heartbeat', n:'Heartbeat (loop)'},
  {v:'float', n:'Float (loop)'},
  {v:'shake', n:'Shake (loop)'},
  {v:'glow', n:'Glow (loop)'},
  {v:'swing', n:'Swing (loop)'},
  {v:'jello', n:'Jello (loop)'},
  {v:'typewriter', n:'Typewriter Blink'},
  {v:'tada', n:'🎉 Tada (loop)'},
  {v:'rubber', n:'↔ Rubber Band (loop)'},
  {v:'wobble', n:'〰 Wobble (loop)'},
  {v:'flipLoop', n:'🔄 Flip Loop'},
  {v:'spinFast', n:'🌀 Spin Fast (loop)'},
  {v:'bounceBig', n:'🏀 Bounce Big (loop)'},
  {v:'slideUD', n:'↕ Slide Up-Down (loop)'},
  {v:'zoomPulse', n:'🔍 Zoom Pulse (loop)'},
  {v:'tilt', n:'🎡 Tilt Swing (loop)'},
  {v:'popSpin', n:'🎈 Pop + Spin (loop)'},
  {v:'storm', n:'🌪 Storm Shake (loop)'},
  {v:'flicker', n:'💡 Flicker (loop)'},
  {v:'blink', n:'👁 Blink (loop)'},
  {v:'roll', n:'🎡 Roll (loop)'},
  {v:'jump', n:'🐇 Jump (loop)'},
  {v:'neon', n:'💠 Neon Glow (loop)'},
];
function ensureTextDefaults(o){
  if(o.size==null) o.size=48;
  if(!o.color) o.color='#ffffff';
  if(!o.font) o.font='Arial';
  if(o.bold==null) o.bold=true;
  if(o.italic==null) o.italic=false;
  if(o.bg==null) o.bg='transparent';
  if(!o.anim) o.anim='none';
  if(o.x==null) o.x=30; if(o.y==null) o.y=40;
  if(o.start==null) o.start=0; if(o.end==null) o.end=5;
  return o;
}
function ensureImageDefaults(o){
  if(o.w==null) o.w=25;
  if(o.opacity==null) o.opacity=1;
  if(!o.anim) o.anim='none';
  if(o.x==null) o.x=10; if(o.y==null) o.y=10;
  return o;
}

/* ---------- helpers ---------- */
const fmt = s => {
  s = Math.max(0, s || 0);
  const m = Math.floor(s / 60), sec = (s % 60);
  return String(m).padStart(2,'0') + ':' + sec.toFixed(1).padStart(4,'0');
};
const selClip = () => clips.find(c => c.id === selectedClipId) || null;
const effDur = c => Math.max(0.01, (c.trimEnd - c.trimStart) / c.speed);
const totalDur = () => clips.reduce((a,c)=>a+effDur(c),0);

function ensureClipDefaults(c){
  if(c.scale==null) c.scale=100;
  if(c.posX==null) c.posX=0;
  if(c.posY==null) c.posY=0;
  if(!c.fit) c.fit='cover';
  if(c.opacity==null) c.opacity=1;
  if(!c.mask) c.mask='none';
  if(c.maskSize==null) c.maskSize=60;
  if(c.maskX==null) c.maskX=50;
  if(c.maskY==null) c.maskY=50;
  if(c.filterStrength==null) c.filterStrength=100;
  if(!c.effect) c.effect='none';
  if(!c.transition) c.transition='none';
  if(c.transDur==null) c.transDur=0.5;
  if(!c.outTransition) c.outTransition='none';
  if(c.outTransDur==null) c.outTransDur=0.5;
  if(!Array.isArray(c.keyframes)) c.keyframes=[];
  return c;
}
function pushHistory(){
  history.push(JSON.stringify({clips,textOverlays,imageOverlays: imageOverlays.map(o=>({...o,img:undefined})),audioClips: audioClips.map(a=>({id:a.id,name:a.name,url:a.url,duration:a.duration,start:a.start,end:a.end,volume:a.volume})),bgMusicName,bgSrc:bgAudio.src}));
  if(history.length>50) history.shift();
}
function undo(){
  if(!history.length) return alert('Nothing to undo');
  const s = JSON.parse(history.pop());
  clips = (s.clips||[]).map(ensureClipDefaults);
  textOverlays = (s.textOverlays||[]).map(ensureTextDefaults); imageOverlays = (s.imageOverlays||[]).map(ensureImageDefaults);
  imageOverlays.forEach(o=>{ if(!o.img){ const im=new Image(); im.src=o.url; o.img=im; }});
  audioClips.forEach(a=>{ try{a.el&&a.el.pause();}catch{} });
  audioClips = (s.audioClips||[]).map(a=>({...a, el:null}));
  if(s.bgSrc){ bgAudio.src=s.bgSrc; bgMusicName=s.bgMusicName; }
  else { bgAudio.removeAttribute('src'); try{bgAudio.load();}catch{} bgMusicName=null; }
  if(!clips.find(c=>c.id===selectedClipId)) selectedClipId = clips[0]?.id||null;
  if(selectedAudioId && !audioClips.find(a=>a.id===selectedAudioId)) selectedAudioId=null;
  if(selectedImageId && !imageOverlays.find(o=>o.id===selectedImageId)) selectedImageId=null;
  if(selectedTextId && !textOverlays.find(o=>o.id===selectedTextId)) selectedTextId=null;
  globalTime=0; syncAll();
}
function clipAt(t){
  let acc=0;
  for(let i=0;i<clips.length;i++){ const d=effDur(clips[i]); if(t<acc+d) return {clip:clips[i],index:i,offset:t-acc}; acc+=d; }
  return null;
}
// offset of selected clip's start in global timeline
function clipStartGlobal(clip){
  let acc=0;
  for(const c of clips){ if(c.id===clip.id) return acc; acc+=effDur(c); }
  return 0;
}

/* ---------- import ---------- */
$('btnImportVideo').onclick=()=>$('fileVideo').click();
$('btnImportImage').onclick=()=>$('fileImage').click();
$('btnImportAudio').onclick=()=>$('fileAudio').click();

$('fileVideo').onchange=e=>{ addVideos([...e.target.files]); e.target.value=''; };
$('fileImage').onchange=e=>{ if(e.target.files.length) addImages([...e.target.files]); e.target.value=''; };
$('fileAudio').onchange=e=>{ if(e.target.files.length) addAudios([...e.target.files]); e.target.value=''; };

function addVideos(files){
  const vids = files.filter(f=>f.type.startsWith('video/'));
  if(!vids.length) return alert('Please select video files');
  pushHistory();
  let pending = vids.length;
  vids.forEach(f=>{
    const url = URL.createObjectURL(f);
    const tmp = document.createElement('video');
    tmp.preload='metadata'; tmp.src=url;
    tmp.onloadedmetadata=()=>{
      clips.push(ensureClipDefaults({id:uid++,name:f.name,url,duration:tmp.duration,trimStart:0,trimEnd:tmp.duration,
        volume:1,filter:'none',filterStrength:100,brightness:100,contrast:100,speed:1,rotate:0,
        scale:100,posX:0,posY:0,fit:'cover',opacity:1,
        mask:'none',maskSize:60,maskX:50,maskY:50,fadeIn:0,fadeOut:0,keyframes:[]}));
      if(!selectedClipId) selectedClipId = clips[0].id;
      if(--pending===0){ syncAll(); }
    };
  });
}
function addImage(file){
  addImages([file]);
}
/* MULTI IMAGE: multiple files become staggered overlays at the playhead */
function addImages(files){
  const imgs = files.filter(f=>f.type.startsWith('image/'));
  if(!imgs.length) return alert('Please select image files');
  pushHistory();
  let base = globalTime || 0;
  const td = totalDur() || Math.max(10, base+imgs.length*4);
  let done = 0;
  imgs.forEach((file,idx)=>{
    const url = URL.createObjectURL(file);
    const im = new Image(); im.src=url;
    im.onload=()=>{
      const start = Math.min(base + idx*0.5, Math.max(0, td-0.5));
      imageOverlays.push(ensureImageDefaults({id:uid++,name:file.name,url,img:im,x:10+(idx*5)%60,y:10+(idx*7)%60,w:25,opacity:1,anim:'none',start,end:Math.min(start+5,Math.max(td,start+2))}));
      if(++done===imgs.length) syncAll();
    };
    im.onerror=()=>{ if(++done===imgs.length) syncAll(); };
  });
}
/* ★ MULTI AUDIO: multiple audio clips at playhead (timeline AUDIO track) */
function addAudios(files){
  const aus = files.filter(f=>f.type.startsWith('audio/'));
  if(!aus.length) return alert('Please select audio files');
  pushHistory();
  let cursor = globalTime || 0;
  let pending = aus.length;
  aus.forEach(f=>{
    const url = URL.createObjectURL(f);
    const tmp = new Audio(); tmp.preload='metadata'; tmp.src=url;
    const finish = (dur)=>{
      const d = (dur && isFinite(dur) && dur>0) ? dur : 10;
      audioClips.push({id:uid++,name:f.name,url,duration:d,start:+cursor.toFixed(2),end:+(cursor+d).toFixed(2),volume:1,el:null});
      cursor += d;
      if(--pending===0){ audioClips.sort((a,b)=>a.start-b.start); syncAll(); }
    };
    tmp.onloadedmetadata=()=>finish(tmp.duration);
    tmp.onerror=()=>finish(10);
  });
}
function setBgMusic(file){
  // legacy single-track entry point — now adds to multi audioClips
  addAudios([file]);
}
function getAudioEl(a){
  if(!a.el){
    a.el = new Audio(a.url);
    a.el.preload='auto';
  }
  return a.el;
}
function addTextAtPlayhead(txt, opts={}){
  pushHistory();
  const td = totalDur()||10;
  const s = Math.min(Math.max(0,globalTime), Math.max(0,td-0.5));
  const o=ensureTextDefaults({id:uid++,text:txt||'Your Text',color:opts.color||'#ffffff',size:opts.size||48,
    x:opts.x??30,y:opts.y??40,start:+s.toFixed(2),end:+Math.min(s+(opts.len||5),Math.max(td,s+1)).toFixed(2),
    font:opts.font||'Arial',bold:opts.bold??true,italic:opts.italic??false,bg:opts.bg||'transparent',anim:opts.anim||'none'});
  textOverlays.push(o); selectedTextId=o.id; selectedImageId=null;
  syncAll();
  return o;
}
$('btnAddText').onclick=()=>{
  addTextAtPlayhead('Your Text');
};
// timeline ＋ buttons: add multiple clips
$('btnAddVideoTl').onclick=()=>$('fileVideo').click();
$('btnAddAudioTl').onclick=()=>$('fileAudio').click();
$('btnAddImageTl').onclick=()=>$('fileImage').click();
$('btnAddTextTl').onclick=()=>addTextAtPlayhead('Your Text');

// drag & drop
const wrap=$('canvasWrap');
['dragover'].forEach(ev=>wrap.addEventListener(ev,e=>{e.preventDefault();wrap.style.outline='2px dashed #2e9b4e';}));
wrap.addEventListener('dragleave',()=>wrap.style.outline='none');
wrap.addEventListener('drop',e=>{
  e.preventDefault(); wrap.style.outline='none';
  const fs=[...(e.dataTransfer.files||[])];
  const v=fs.filter(f=>f.type.startsWith('video/')), im=fs.filter(f=>f.type.startsWith('image/')), au=fs.filter(f=>f.type.startsWith('audio/'));
  if(v.length) addVideos(v); if(im.length) addImages(im); if(au.length) addAudios(au);
});

/* ---------- render lists + timeline ---------- */
function syncAll(){ renderClipList(); renderOverlays(); renderTimeline(); renderKeyframes(); syncSettings(); renderTextLayer(); updateTimeUI(); $('dropHint').style.display = clips.length?'none':'block'; $('clipCount').textContent=clips.length; }

function renderClipList(){
  const el=$('clipList'); el.innerHTML = clips.length?'':'<p class="hint">Import videos to start.</p>';
  clips.forEach((c,i)=>{
    ensureClipDefaults(c);
    const d=document.createElement('div'); d.className='clip-item'+(c.id===selectedClipId?' active':'');
    const kf = c.keyframes?.length?` • 🔑${c.keyframes.length}`:'';
    const mk = c.mask!=='none'?` • 🎭${c.mask}`:'';
    const ef = c.effect!=='none'?` • ✨${c.effect}`:'';
    const tr = c.transition!=='none'?` • 🔀IN:${transName(c.transition)}`:'';
    const trOut = c.outTransition&&c.outTransition!=='none'?` • 🔗OUT:${transName(c.outTransition)}`:'';
    d.innerHTML=`<b>${i+1}. ${c.name}</b><small>${fmt(c.trimEnd-c.trimStart)} • ${c.speed}x • ${c.rotate}° • 🔍${c.scale}%${kf}${mk}${ef}${tr}${trOut}</small>`;
    const r=document.createElement('div'); r.className='row';
    const bSel=document.createElement('button'); bSel.textContent='Select'; bSel.onclick=()=>{selectedClipId=c.id;syncAll();seekToClip(i);};
    const bL=document.createElement('button'); bL.textContent='◀'; bL.title='Move left'; bL.onclick=()=>moveClip(i,-1);
    const bR=document.createElement('button'); bR.textContent='▶'; bR.title='Move right'; bR.onclick=()=>moveClip(i,1);
    const bD=document.createElement('button'); bD.textContent='🗑'; bD.title='Delete'; bD.onclick=()=>delClip(i);
    r.append(bSel,bL,bR,bD); d.append(r); el.append(d);
  });
}
function moveClip(i,dir){ const j=i+dir; if(j<0||j>=clips.length) return; pushHistory(); [clips[i],clips[j]]=[clips[j],clips[i]]; syncAll(); }
function delClip(i){ pushHistory(); clips.splice(i,1); if(!clips.find(c=>c.id===selectedClipId)) selectedClipId=clips[0]?.id||null; globalTime=0; pause(); syncAll(); }

function renderOverlays(){
  const el=$('overlayList'); el.innerHTML='';
  textOverlays.forEach(o=>{
    ensureTextDefaults(o);
    const d=document.createElement('div'); d.className='clip-item'+(o.id===selectedTextId?' active':'');
    d.innerHTML=`<b>📝 ${escapeHtml(o.text).slice(0,18)||'Text'}</b><small>${fmt(o.start)} → ${fmt(o.end)} (${(o.end-o.start).toFixed(1)}s) • ${o.size}px • 🎞${o.anim}</small>`;
    const r=document.createElement('div'); r.className='row';
    const bP=document.createElement('button'); bP.textContent='✏️'; bP.title='Edit text';
    bP.onclick=()=>{selectedTextId=o.id;selectedImageId=null;syncSettings();seek(o.start+0.01);syncAll();focusTextEditor();};
    const bE=document.createElement('button'); bE.textContent='Select'; bE.title='Select and seek to text';
    bE.onclick=()=>{selectedTextId=o.id;selectedImageId=null;syncSettings();seek(o.start+0.01);syncAll();};
    const bD=document.createElement('button'); bD.textContent='🗑'; bD.title='Delete'; bD.onclick=()=>{pushHistory();textOverlays=textOverlays.filter(x=>x.id!==o.id);if(selectedTextId===o.id)selectedTextId=null;syncAll();};
    r.append(bP,bE,bD); d.append(r); el.append(d);
  });
  imageOverlays.forEach(o=>{
    ensureImageDefaults(o);
    const d=document.createElement('div'); d.className='clip-item'+(o.id===selectedImageId?' active':'');
    d.innerHTML=`<b>🖼 ${o.name.slice(0,18)}</b><small>${fmt(o.start)} → ${fmt(o.end)} (${(o.end-o.start).toFixed(1)}s) • ${o.w}% • 🎞${o.anim}</small>`;
    const r=document.createElement('div'); r.className='row';
    const bS=document.createElement('button'); bS.textContent='Edit'; bS.onclick=()=>{selectedImageId=o.id;selectedTextId=null;syncSettings();seek(o.start+0.01);syncAll();};
    const bD=document.createElement('button'); bD.textContent='🗑 Delete'; bD.onclick=()=>{pushHistory();imageOverlays=imageOverlays.filter(x=>x.id!==o.id);if(selectedImageId===o.id)selectedImageId=null;syncAll();};
    r.append(bS,bD); d.append(r); el.append(d);
  });
  /* MULTI AUDIO list with volume + timing edit */
  audioClips.forEach(o=>{
    const d=document.createElement('div'); d.className='clip-item'+(o.id===selectedAudioId?' active':'');
    d.innerHTML=`<b>🎵 ${o.name.slice(0,18)}</b><small>${fmt(o.start)} → ${fmt(o.end)} (${(o.end-o.start).toFixed(1)}s) • vol ${Math.round(o.volume*100)}%</small>`;
    const r=document.createElement('div'); r.className='row';
    const bS=document.createElement('button'); bS.textContent='Seek'; bS.title='Move playhead to clip start'; bS.onclick=()=>{selectedAudioId=o.id;seek(o.start+0.01);syncAll();};
    const bV=document.createElement('button'); bV.textContent=o.volume>0?'🔊':'🔇'; bV.title='Mute/unmute';
    bV.onclick=()=>{pushHistory();o.volume=o.volume>0?0:1;syncAudios();syncAll();};
    const bD=document.createElement('button'); bD.textContent='🗑'; bD.onclick=()=>{pushHistory();try{getAudioEl(o).pause();}catch{} audioClips=audioClips.filter(x=>x.id!==o.id);if(selectedAudioId===o.id)selectedAudioId=null;syncAll();};
    r.append(bS,bV,bD); d.append(r);
    // inline start/end/volume editors
    const r2=document.createElement('div'); r2.className='row';
    const iS=document.createElement('button'); iS.textContent='⏮ -1s'; iS.title='Move start 1s earlier';
    iS.onclick=()=>{pushHistory();o.start=Math.max(0,o.start-1);o.end=Math.max(o.start+0.5,o.end-1);syncAll();};
    const iE=document.createElement('button'); iE.textContent='+1s ⏭'; iE.title='Shift forward';
    iE.onclick=()=>{pushHistory();o.start=o.start+1;o.end=o.end+1;syncAll();};
    r2.append(iS,iE); d.append(r2);
    el.append(d);
  });
  if(bgMusicName){
    const d=document.createElement('div'); d.className='clip-item';
    d.innerHTML=`<b>🎵 ${bgMusicName.slice(0,20)}</b><small>legacy bg music</small>`;
    const b=document.createElement('button'); b.textContent='Remove music'; b.onclick=()=>{pushHistory();bgAudio.removeAttribute('src');bgAudio.load();bgMusicName=null;syncAll();};
    d.append(b); el.append(d);
  }
  if(!textOverlays.length && !imageOverlays.length && !audioClips.length && !bgMusicName){
    el.innerHTML='<p class="hint">No overlays.<br>Add with ＋ Audio/Text/Image.</p>';
  }
}
function escapeHtml(s){ return String(s||'').replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])); }

/* ----- zoomable timeline + ruler + playhead (+/- icons, Fit, %) ----- */
function setZoom(v){
  pxPerSec=Math.min(400,Math.max(20,Math.round(v)));
  $('zoomSlider').value=pxPerSec;
  const zv=$('zoomVal'); if(zv) zv.textContent=pxPerSec+'px/s';
  renderTimeline(); updatePlayhead();
}
$('zoomSlider').oninput=e=>setZoom(+e.target.value);
$('btnZoomIn').onclick=()=>setZoom(pxPerSec+40);
$('btnZoomOut').onclick=()=>setZoom(pxPerSec-40);
$('btnZoomFit').onclick=()=>{
  const tot=totalDur()||10;
  const avail=Math.max(60,$('timelineScroll').clientWidth-32);
  setZoom(avail/Math.max(0.5,tot));
};

function niceStep(){
  const target=70; // px per tick
  const cands=[0.25,0.5,1,2,5,10,15,30,60,120];
  for(const s of cands){ if(s*pxPerSec>=target) return s; }
  return 300;
}
function renderRuler(){
  const r=$('ruler'); r.innerHTML='';
  const tot=totalDur();
  if(!tot) return;
  const step=niceStep();
  const w=Math.max(r.parentElement.clientWidth-16, tot*pxPerSec);
  r.style.width=w+'px';
  for(let t=0;t<=tot+0.001;t+=step){
    const d=document.createElement('div');
    d.className='tick'+(step>=2?' major':'');
    d.style.left=(t*pxPerSec)+'px';
    d.textContent=fmt(t);
    r.append(d);
  }
}

/* Duration drag: edge handles on timeline blocks (adjust duration directly) */
function addEdgeHandles(block, get, set, opts={}){
  const minLen=opts.minLen||0.4;
  const mk=(side)=>{
    const h=document.createElement('div'); h.className='tl-handle '+side; h.textContent=side==='left'?'◀':'▶';
    h.title=side==='left'?'Drag to adjust start':'Drag to adjust duration / end';
    h.onpointerdown=(e)=>{
      e.preventDefault(); e.stopPropagation();
      pushHistory();
      const sx=e.clientX; const orig={...get()};
      try{ e.target.setPointerCapture(e.pointerId); }catch{}
      const mv=(ev)=>{
        const dt=(ev.clientX-sx)/pxPerSec;
        if(side==='left'){
          if(opts.video){
            const c=opts.video; const dSrc=dt*c.speed;
            let ns=Math.min(Math.max(0,orig.trimStart+dSrc),orig.trimEnd-0.2*c.speed);
            c.trimStart=+ns.toFixed(2);
            block.style.width=Math.max(50,effDur(c)*pxPerSec)+'px';
            block.title=`${c.name}\n${fmt(c.trimStart)} → ${fmt(c.trimEnd)} (${fmt(effDur(c))})\nDrag edges to adjust duration`;
          } else {
            let ns=Math.min(Math.max(0,orig.start+dt),orig.end-minLen);
            set({start:+ns.toFixed(2)});
            block.style.left=(ns*pxPerSec)+'px';
            block.style.width=Math.max(30,(orig.end-ns)*pxPerSec)+'px';
          }
        } else {
          if(opts.video){
            const c=opts.video; const dSrc=dt*c.speed;
            let ne=Math.max(Math.min(c.duration,orig.trimEnd+dSrc),orig.trimStart+0.2*c.speed);
            c.trimEnd=+ne.toFixed(2);
            block.style.width=Math.max(50,effDur(c)*pxPerSec)+'px';
            block.title=`${c.name}\n${fmt(c.trimStart)} → ${fmt(c.trimEnd)} (${fmt(effDur(c))})\nDrag edges to adjust duration`;
          } else {
            let ne=Math.max(orig.start+minLen,orig.end+dt);
            set({end:+ne.toFixed(2)});
            block.style.width=Math.max(30,(ne-orig.start)*pxPerSec)+'px';
            if(opts.onLive) opts.onLive(ne);
          }
        }
      };
      const up=()=>{ window.removeEventListener('pointermove',mv); window.removeEventListener('pointerup',up); syncAll(); };
      window.addEventListener('pointermove',mv); window.addEventListener('pointerup',up);
    };
    return h;
  };
  block.append(mk('left'),mk('right'));
}
function renderTimeline(){
  const vt=$('videoTrack'); vt.innerHTML='';
  const tot=totalDur()||Math.max(10, ...audioClips.map(a=>a.end), ...textOverlays.map(o=>o.end), ...imageOverlays.map(o=>o.end), 1);
  const contentW=Math.max($('timelineScroll').clientWidth-16, tot*pxPerSec);
  clips.forEach((c,i)=>{
    ensureClipDefaults(c);
    const w=Math.max(50, effDur(c)*pxPerSec);
    const b=document.createElement('div'); b.className='clip-block'+(c.id===selectedClipId?' active':'');
    b.style.width=w+'px';
    const fxTag=c.effect&&c.effect!=='none'?' ✨'+c.effect:'';
    const inTag=c.transition&&c.transition!=='none'?' 🔀IN:'+transName(c.transition):'';
    const outTag=c.outTransition&&c.outTransition!=='none'?' 🔗OUT:'+transName(c.outTransition):'';
    const label=document.createElement('span'); label.textContent=`${i+1} ▮ ${fmt(effDur(c))}${c.scale!==100?' 🔍'+c.scale+'%':''}${fxTag}${inTag}${outTag}`;
    b.append(label);
    b.title=`${c.name}\n${fmt(c.trimStart)} → ${fmt(c.trimEnd)} (${fmt(effDur(c))})\nEffect: ${c.effect} • IN: ${transName(c.transition)} • OUT: ${transName(c.outTransition||'none')}\nClick = seek exact position • Drag ◀ ▶ edges = adjust duration`;
    // keyframe diamonds
    (c.keyframes||[]).forEach(k=>{
      const dot=document.createElement('span'); dot.className='kf-dot'; dot.title=`🔑 ${fmt(k.t)}`;
      dot.style.left=`calc(${(k.t/effDur(c)*100).toFixed(1)}% - 4px)`;
      b.append(dot);
    });
    b.onclick=(e)=>{
      if(e.target.closest('.tl-handle')) return;
      selectedClipId=c.id;
      // exact-time seek: click position inside block
      const rect=b.getBoundingClientRect();
      const frac=Math.min(1,Math.max(0,(e.clientX-rect.left)/rect.width));
      let t=0; for(let k=0;k<i;k++) t+=effDur(clips[k]);
      seek(t+frac*effDur(c));
      syncAll();
    };
    addEdgeHandles(b, ()=>({trimStart:c.trimStart,trimEnd:c.trimEnd}), ()=>{}, {video:c});
    vt.append(b);
    /* between-clips joint badge */
    if(i<clips.length-1){
      const nx=ensureClipDefaults(clips[i+1]);
      const hasOut=c.outTransition&&c.outTransition!=='none', hasIn=nx.transition&&nx.transition!=='none';
      const j=document.createElement('div'); j.className='joint-badge'+((hasOut||hasIn)?' has-anim':'');
      j.textContent=(hasOut||hasIn)?`🔗 ${hasOut?transName(c.outTransition):'…'}→${hasIn?transName(nx.transition):'…'}`:'🔗 +';
      j.title=`Between clips ${i+1} → ${i+2}\nOUT: ${transName(c.outTransition||'none')} + IN: ${transName(nx.transition||'none')}\nClick to edit this joint`;
      j.onclick=()=>{ selectedClipId=c.id; syncAll(); seekToClip(i+1); openFx('between'); };
      vt.append(j);
    }
  });
  vt.style.width=contentW+'px';
  /* MULTI AUDIO track: absolute clips */
  const at=$('audioTrack');
  at.style.width=contentW+'px';
  at.innerHTML='';
  if(bgMusicName){
    const base=document.createElement('div'); base.className='clip-block';
    base.style.left='0px'; base.style.width=(tot*pxPerSec)+'px'; base.style.opacity='0.55';
    base.textContent=`♪ ${bgMusicName} (${fmt(tot)})`;
    base.title='Legacy bg music (full length)';
    at.append(base);
  }
  audioClips.forEach(o=>{
    const b=document.createElement('div'); b.className='clip-block'+(o.id===selectedAudioId?' selected':'');
    b.style.left=(o.start*pxPerSec)+'px';
    b.style.width=Math.max(30,(o.end-o.start)*pxPerSec)+'px';
    const sp=document.createElement('span'); sp.textContent='🎵 '+o.name.slice(0,14)+` ${fmt(o.end-o.start)}`;
    b.append(sp);
    b.title=`${o.name}\n${fmt(o.start)} → ${fmt(o.end)} (${(o.end-o.start).toFixed(1)}s)\nClick = seek • Drag ◀ ▶ = adjust duration • Double-click = delete`;
    b.onclick=(e)=>{ if(e.target.closest('.tl-handle')) return; selectedAudioId=o.id;seek(o.start+0.01);syncAll();};
    b.ondblclick=()=>{if(confirm('Delete audio clip "'+o.name+'"?')){pushHistory();try{getAudioEl(o).pause();}catch{} audioClips=audioClips.filter(x=>x.id!==o.id);if(selectedAudioId===o.id)selectedAudioId=null;syncAll();}};
    addEdgeHandles(b, ()=>({start:o.start,end:o.end}), (v)=>{ if(v.start!=null)o.start=v.start; if(v.end!=null)o.end=v.end; }, {});
    at.append(b);
  });
  if(!audioClips.length && !bgMusicName){
    at.innerHTML='<div class="audio-hint">No audio — add multiple clips with ＋ Audio</div>';
  }
  /* MULTI TEXT track: absolute clips */
  const tt=$('textTrack'); tt.innerHTML=''; tt.style.width=contentW+'px';
  [...textOverlays].sort((a,b)=>a.start-b.start).forEach(o=>{
    ensureTextDefaults(o);
    const b=document.createElement('div'); b.className='clip-block'+(o.id===selectedTextId?' selected':'');
    b.style.left=(o.start*pxPerSec)+'px';
    b.style.width=Math.max(30,(o.end-o.start)*pxPerSec)+'px';
    const sp=document.createElement('span'); sp.textContent='✏️ '+o.text.slice(0,10)+` ${o.size}px ${(o.end-o.start).toFixed(1)}s`+(o.anim!=='none'?' 🎞':'');
    b.append(sp);
    b.title=`${o.text}\n${fmt(o.start)} → ${fmt(o.end)} (${(o.end-o.start).toFixed(1)}s) • ${o.size}px • 🎞${o.anim}\nClick = edit • ✏️ = edit text • Drag ◀ ▶ = adjust duration • Double-click = delete`;
    b.onclick=(e)=>{ if(e.target.closest('.tl-handle')) return; selectedTextId=o.id;selectedImageId=null;seek(o.start+0.01);syncAll();};
    b.ondblclick=(e)=>{ if(e.target.closest('.tl-handle')) return; selectedTextId=o.id;selectedImageId=null;syncSettings();focusTextEditor(); };
    addEdgeHandles(b, ()=>({start:o.start,end:o.end}), (v)=>{ if(v.start!=null)o.start=v.start; if(v.end!=null)o.end=v.end; }, {});
    tt.append(b);
  });
  /* MULTI IMAGE track: absolute clips */
  const it=$('imageTrack'); it.innerHTML=''; it.style.width=contentW+'px';
  [...imageOverlays].sort((a,b)=>a.start-b.start).forEach(o=>{
    ensureImageDefaults(o);
    const b=document.createElement('div'); b.className='clip-block'+(o.id===selectedImageId?' selected':'');
    b.style.left=(o.start*pxPerSec)+'px';
    b.style.width=Math.max(30,(o.end-o.start)*pxPerSec)+'px';
    const sp=document.createElement('span'); sp.textContent='🖼 '+o.name.slice(0,10)+` ${o.w}% ${(o.end-o.start).toFixed(1)}s`+(o.anim!=='none'?' 🎞':'');
    b.append(sp);
    b.title=`${o.name}\n${fmt(o.start)} → ${fmt(o.end)} (${(o.end-o.start).toFixed(1)}s) • ${o.w}% • 🎞${o.anim}\nClick = edit • Drag ◀ ▶ = adjust duration • Double-click = delete`;
    b.onclick=(e)=>{ if(e.target.closest('.tl-handle')) return; selectedImageId=o.id;selectedTextId=null;seek(o.start+0.01);syncAll();};
    b.ondblclick=()=>{if(confirm('Delete image overlay?')){pushHistory();imageOverlays=imageOverlays.filter(x=>x.id!==o.id);if(selectedImageId===o.id)selectedImageId=null;syncAll();}};
    addEdgeHandles(b, ()=>({start:o.start,end:o.end}), (v)=>{ if(v.start!=null)o.start=v.start; if(v.end!=null)o.end=v.end; }, {});
    it.append(b);
  });
  $('totalDur').textContent='total '+fmt(tot);
  renderRuler();
  updatePlayhead();
}
function seekToClip(i){ let t=0; for(let k=0;k<i;k++) t+=effDur(clips[k]); seek(t+0.01); }

// click anywhere on ruler / scroll background to seek exact time
$('timelineScroll').addEventListener('pointerdown',e=>{
  if(e.target.closest('.clip-block')||e.target.closest('button')||e.target.closest('input')) return;
  const sc=$('timelineScroll');
  const rulerRect=$('ruler').getBoundingClientRect();
  const x=e.clientX-rulerRect.left;
  seek(Math.min(totalDur(),Math.max(0,x/pxPerSec)));
});
function updatePlayhead(){
  const line=$('playheadLine');
  if(!line) return;
  line.style.left=(8+globalTime*pxPerSec)+'px';
  line.style.top='0px';
  line.style.height=$('timelineScroll').scrollHeight+'px';
  $('timelineTime').textContent=fmt(globalTime);
}

/* ---------- keyframes ---------- */
function keyOffsetInSelected(){
  const c=selClip(); if(!c) return null;
  const found=clipAt(Math.min(globalTime,totalDur()-0.001));
  if(found && found.clip.id===c.id) return found.offset;
  return null;
}
$('btnAddKeyframe').onclick=()=>{
  const c=selClip(); if(!c) return alert('Select a clip first');
  ensureClipDefaults(c);
  const off=keyOffsetInSelected();
  if(off==null) return alert('Place the playhead inside the selected clip, then press Add Key');
  pushHistory();
  c.keyframes.push({id:uid++,t:+off.toFixed(2),scale:c.scale,opacity:Math.round(c.opacity*100)});
  c.keyframes.sort((a,b)=>a.t-b.t);
  syncAll();
};
$('btnClearKeyframes').onclick=()=>{
  const c=selClip(); if(!c||!c.keyframes.length) return;
  pushHistory(); c.keyframes=[]; syncAll();
};
function renderKeyframes(){
  const el=$('keyframeList'); if(!el) return;
  const c=selClip();
  if(!c||!c.keyframes||!c.keyframes.length){ el.innerHTML='<p class="hint">No keyframes.<br>Place the playhead → Add Key.</p>'; return; }
  el.innerHTML='';
  [...c.keyframes].sort((a,b)=>a.t-b.t).forEach(k=>{
    const d=document.createElement('div'); d.className='kf-item';
    d.innerHTML=`<span class="dot">◆</span><span>${fmt(k.t)} • 🔍${k.scale}% • 👻${k.opacity}%</span>`;
    const bG=document.createElement('button'); bG.textContent='Go'; bG.title='Jump playhead';
    bG.onclick=()=>{ const s=clipStartGlobal(c); seek(s+k.t); };
    const bD=document.createElement('button'); bD.textContent='✕';
    bD.onclick=()=>{ pushHistory(); c.keyframes=c.keyframes.filter(x=>x.id!==k.id); syncAll(); };
    d.append(bG,bD); el.append(d);
  });
}
// interpolate scale/opacity at effective offset
function animatedProps(clip, timeInClip){
  ensureClipDefaults(clip);
  const keys=[...(clip.keyframes||[])].sort((a,b)=>a.t-b.t);
  if(!keys.length) return {scale:clip.scale, opacity:clip.opacity};
  if(timeInClip<=keys[0].t) return {scale:keys[0].scale, opacity:keys[0].opacity/100};
  if(timeInClip>=keys[keys.length-1].t){ const l=keys[keys.length-1]; return {scale:l.scale, opacity:l.opacity/100}; }
  for(let i=0;i<keys.length-1;i++){
    const a=keys[i], b=keys[i+1];
    if(timeInClip>=a.t&&timeInClip<=b.t){
      const f=(timeInClip-a.t)/Math.max(0.001,b.t-a.t);
      return {scale:a.scale+(b.scale-a.scale)*f, opacity:(a.opacity+(b.opacity-a.opacity)*f)/100};
    }
  }
  return {scale:clip.scale, opacity:clip.opacity};
}

/* ---------- settings panel ---------- */
function syncSettings(){
  const c=selClip();
  $('clipLabel').textContent = c?`Clip: ${c.name} | ${fmt(c.trimStart)}→${fmt(c.trimEnd)} | ${c.speed}x | 🔍${c.scale}% | 🎭${c.mask} | ✨${c.effect} | 🔀IN:${transName(c.transition)} OUT:${transName(c.outTransition||'none')}`:'No clip selected';
  if(c){
    ensureClipDefaults(c);
    $('filterSelect').value=c.filter; $('volumeSlider').value=c.volume*100; $('volVal').textContent=Math.round(c.volume*100)+'%';
    $('filterStrength').value=c.filterStrength; $('filterStrVal').textContent=c.filterStrength+'%';
    $('brightness').value=c.brightness; $('briVal').textContent=c.brightness+'%';
    $('contrast').value=c.contrast; $('conVal').textContent=c.contrast+'%';
    $('speedSlider').value=c.speed*100; $('speedVal').textContent=c.speed+'x';
    $('fadeIn').value=c.fadeIn; $('fadeOut').value=c.fadeOut;
    $('trimStart').value=c.trimStart.toFixed(1); $('trimEnd').value=c.trimEnd.toFixed(1);
    $('scaleSlider').value=c.scale; $('scaleVal').textContent=c.scale+'%';
    $('posX').value=c.posX; $('posY').value=c.posY;
    $('fitSelect').value=c.fit;
    $('opacitySlider').value=Math.round(c.opacity*100); $('opacityVal').textContent=Math.round(c.opacity*100)+'%';
    $('maskSelect').value=c.mask;
    $('maskSize').value=c.maskSize; $('maskSizeVal').textContent=c.maskSize+'%';
    $('maskX').value=c.maskX; $('maskY').value=c.maskY;
    $('effectSelect').value=c.effect||'none';
    $('transSelect').value=c.transition||'none';
    $('transDur').value=c.transDur??0.5;
    if($('transOutSelect')) $('transOutSelect').value=c.outTransition||'none';
    if($('transOutDur')) $('transOutDur').value=c.outTransDur??0.5;
  }
  renderJoints();
  const t=textOverlays.find(x=>x.id===selectedTextId);
  $('textEditor').style.display=t?'block':'none';
  if(t){
    ensureTextDefaults(t);
    const ae=(typeof document!=='undefined'&&document.activeElement)?document.activeElement:null;
    /* don't overwrite a focused input (typing/caret safe) */
    if(ae!==$('textContent')) $('textContent').value=t.text;
    $('textColor').value=t.color;
    if(ae!==$('textSize')) $('textSize').value=t.size;
    $('textSizeSlider').value=t.size; $('textSizeVal').textContent=t.size+'px';
    $('textFont').value=t.font; $('textBg').value=(t.bg==='transparent'?'#ff0000':t.bg);
    $('textX').value=t.x; $('textY').value=t.y; $('textAnim').value=t.anim;
    if(ae!==$('textStart')) $('textStart').value=t.start;
    if(ae!==$('textEnd')) $('textEnd').value=t.end;
    if($('textDur') && ae!==$('textDur')) $('textDur').value=+(t.end-t.start).toFixed(1);
    $('btnTextBold').classList.toggle('primary',!!t.bold);
    $('btnTextItalic').classList.toggle('primary',!!t.italic);
  }
  const im=imageOverlays.find(x=>x.id===selectedImageId);
  $('imageEditor').style.display=im?'block':'none';
  if(im){
    ensureImageDefaults(im);
    $('imgSizeSlider').value=im.w; $('imgSizeVal').textContent=im.w+'%';
    $('imgOpacity').value=Math.round(im.opacity*100); $('imgOpVal').textContent=Math.round(im.opacity*100)+'%';
    $('imgAnim').value=im.anim;
    const ae2=document.activeElement;
    if(ae2!==$('imgStart')) $('imgStart').value=im.start;
    if(ae2!==$('imgEnd')) $('imgEnd').value=im.end;
    if($('imgDur') && ae2!==$('imgDur')) $('imgDur').value=+(im.end-im.start).toFixed(1);
  }
}
/* Between-clips joints list (OUT of clip i + IN of clip i+1) */
function renderJoints(){
  const el=$('jointList'); if(!el) return;
  const jc=$('jointCount'); if(jc) jc.textContent=clips.length>1?`(${clips.length-1} joints)`:'';
  if(clips.length<2){ el.innerHTML='<p class="hint">Add at least 2 clips<br>to set between-animations.</p>'; return; }
  el.innerHTML='';
  for(let i=0;i<clips.length-1;i++){
    const a=ensureClipDefaults(clips[i]), b=ensureClipDefaults(clips[i+1]);
    const has=(a.outTransition&&a.outTransition!=='none')||(b.transition&&b.transition!=='none');
    const d=document.createElement('div'); d.className='kf-item';
    d.innerHTML=`<span class="dot">🔗</span><span>${i+1}→${i+2}: OUT ${transName(a.outTransition||'none')} + IN ${transName(b.transition||'none')}</span>`;
    const bE=document.createElement('button'); bE.textContent='Edit'; bE.title='Select the outgoing clip to edit this joint';
    bE.onclick=()=>{ selectedClipId=a.id; syncAll(); seekToClip(i); if(fxMode) openFx(fxMode); };
    const bC=document.createElement('button'); bC.textContent='✕'; bC.title='Clear joint animations';
    bC.onclick=()=>{ pushHistory(); a.outTransition='none'; b.transition='none'; syncAll(); };
    d.append(bE,bC); el.append(d);
  }
  const all=document.createElement('div'); all.className='kf-item';
  all.innerHTML=`<span>Apply one animation to all joints:</span>`;
  const sel=document.createElement('select'); sel.style.flex='1';
  const none=document.createElement('option'); none.value='none'; none.textContent='Choose animation…'; sel.append(none);
  TRANSITIONS.forEach(t=>{ const op=document.createElement('option'); op.value=t.v; op.textContent=t.n; sel.append(op); });
  const btn=document.createElement('button'); btn.textContent='Apply All'; btn.title='Set OUT + IN of every joint';
  btn.onclick=()=>{ if(sel.value==='none') return; pushHistory(); clips.forEach((c,idx)=>{ ensureClipDefaults(c); if(idx<clips.length-1) c.outTransition=sel.value; if(idx>0) c.transition=sel.value; const dIn=Math.max(0.1,Math.min(3,+$('transDur').value||0.5)); const dOut=Math.max(0.1,Math.min(3,+$('transOutDur').value||0.5)); if(idx<clips.length-1) c.outTransDur=dOut; if(idx>0) c.transDur=dIn; }); syncAll(); };
  all.append(sel,btn); el.append(all);
}
$('filterSelect').onchange=e=>{const c=selClip();if(!c)return;pushHistory();c.filter=e.target.value;};
$('filterStrength').oninput=e=>{const c=selClip();if(!c)return;c.filterStrength=+e.target.value;$('filterStrVal').textContent=e.target.value+'%';};
$('filterStrength').onchange=()=>pushHistory();
$('volumeSlider').oninput=e=>{const c=selClip();if(!c)return;c.volume=e.target.value/100;$('volVal').textContent=e.target.value+'%';video.volume=c.volume;};
$('volumeSlider').onchange=()=>pushHistory();
$('musicVolume').oninput=e=>{bgAudio.volume=e.target.value/100;$('musicVolVal').textContent=e.target.value+'%';syncAudios();};
$('brightness').oninput=e=>{const c=selClip();if(!c)return;c.brightness=+e.target.value;$('briVal').textContent=e.target.value+'%';};
$('contrast').oninput=e=>{const c=selClip();if(!c)return;c.contrast=+e.target.value;$('conVal').textContent=e.target.value+'%';};
$('speedSlider').oninput=e=>{const c=selClip();if(!c)return;c.speed=e.target.value/100;$('speedVal').textContent=c.speed.toFixed(2).replace(/0+$/,'').replace(/\.$/,'')+'x';video.playbackRate=c.speed;renderTimeline();};
$('speedSlider').onchange=()=>pushHistory();
// scale
$('scaleSlider').oninput=e=>{const c=selClip();if(!c)return;c.scale=+e.target.value;$('scaleVal').textContent=e.target.value+'%';syncSettings();};
$('scaleSlider').onchange=()=>pushHistory();
$('posX').onchange=e=>{const c=selClip();if(!c)return;pushHistory();c.posX=Math.max(-100,Math.min(100,+e.target.value||0));};
$('posY').onchange=e=>{const c=selClip();if(!c)return;pushHistory();c.posY=Math.max(-100,Math.min(100,+e.target.value||0));};
$('fitSelect').onchange=e=>{const c=selClip();if(!c)return;pushHistory();c.fit=e.target.value;};
$('opacitySlider').oninput=e=>{const c=selClip();if(!c)return;c.opacity=e.target.value/100;$('opacityVal').textContent=e.target.value+'%';};
$('opacitySlider').onchange=()=>pushHistory();
$('btnResetScale').onclick=()=>{const c=selClip();if(!c)return;pushHistory();c.scale=100;c.posX=0;c.posY=0;c.fit='cover';c.opacity=1;syncAll();};
// mask
$('maskSelect').onchange=e=>{const c=selClip();if(!c)return alert('Select a clip first');pushHistory();c.mask=e.target.value;syncAll();};
$('maskSize').oninput=e=>{const c=selClip();if(!c)return;c.maskSize=+e.target.value;$('maskSizeVal').textContent=e.target.value+'%';};
$('maskSize').onchange=()=>pushHistory();
$('maskX').onchange=e=>{const c=selClip();if(!c)return;pushHistory();c.maskX=Math.max(0,Math.min(100,+e.target.value||50));};
$('maskY').onchange=e=>{const c=selClip();if(!c)return;pushHistory();c.maskY=Math.max(0,Math.min(100,+e.target.value||50));};
// effect + transition bindings (settings + drawer)
$('effectSelect').onchange=e=>{const c=selClip();if(!c) return alert('Select a video clip first');pushHistory();c.effect=e.target.value;syncAll();};
$('transSelect').onchange=e=>{const c=selClip();if(!c) return alert('Select a video clip first');pushHistory();c.transition=e.target.value;syncAll();};
$('transDur').onchange=e=>{const c=selClip();if(!c)return;pushHistory();c.transDur=Math.max(0.1,Math.min(3,+e.target.value||0.5));};
$('transOutSelect').onchange=e=>{const c=selClip();if(!c) return alert('Select a video clip first');pushHistory();c.outTransition=e.target.value;syncAll();};
$('transOutDur').onchange=e=>{const c=selClip();if(!c)return;pushHistory();c.outTransDur=Math.max(0.1,Math.min(3,+e.target.value||0.5));};
function fillTransSelect(sel){
  if(!sel) return;
  sel.innerHTML='<option value="none">None</option>';
  [...new Set(TRANSITIONS.map(t=>t.cat))].forEach(cat=>{
    const g=document.createElement('optgroup'); g.label=cat;
    TRANSITIONS.filter(t=>t.cat===cat).forEach(t=>{
      const op=document.createElement('option'); op.value=t.v; op.textContent=t.n; g.append(op);
    });
    sel.append(g);
  });
}
/* populate effect / transition / text+image animation dropdowns */
(function populateFxSelects(){
  const es=$('effectSelect');
  if(es){ es.innerHTML=''; EFFECTS.forEach(f=>{ const op=document.createElement('option'); op.value=f.v; op.textContent=f.n+(f.d&&f.v!=='none'?' — '+f.d:''); es.append(op); }); }
  fillTransSelect($('transSelect'));
  fillTransSelect($('transOutSelect'));
  const ta=$('textAnim');
  if(ta){ ta.innerHTML=''; TEXT_ANIMS.forEach(a=>{ const op=document.createElement('option'); op.value=a.v; op.textContent=a.n; ta.append(op); }); }
  const ia=$('imgAnim');
  if(ia){ ia.innerHTML=''; TEXT_ANIMS.forEach(a=>{ const op=document.createElement('option'); op.value=a.v; op.textContent=a.n; ia.append(op); }); }
  const tc=$('transCount'); if(tc) tc.textContent=TRANSITIONS.length+' styles';
})();

document.querySelectorAll('[data-rot]').forEach(b=>b.onclick=()=>{const c=selClip();if(!c)return alert('Select a clip first');pushHistory();c.rotate=+b.dataset.rot;syncAll();});
/* Export resolution follows canvas size (e.g. Shorts) until the user picks one manually */
let expResAuto=true;
if($('expRes')) $('expRes').onchange=()=>{expResAuto=false;};
$('canvasSize').onchange=e=>{
  const [w,h]=e.target.value.split('x').map(Number);canvas.width=w;canvas.height=h;
  if(expResAuto){
    const key=w+'x'+h, sel=$('expRes');
    if(sel&&[...sel.options].some(o=>o.value===key)) sel.value=key;
  }
};
/* Preview layout: adjust frame preview from the left (offset / width / align) */
let previewLayout={align:'center',offset:0,width:100};
function applyPreviewLayout(){
  const wrapEl=$('canvasWrap'); if(!wrapEl) return;
  wrapEl.style.width=previewLayout.width+'%';
  wrapEl.style.marginLeft=previewLayout.align==='left'?previewLayout.offset+'%':previewLayout.align==='right'?'auto':previewLayout.offset?`calc((100% - ${previewLayout.width}%) / 2 + ${previewLayout.offset}%)`:'auto';
  wrapEl.style.marginRight=previewLayout.align==='right'?'0':previewLayout.align==='left'?'auto':'auto';
  const l=$('btnAlignLeft'),c=$('btnAlignCenter'),r=$('btnAlignRight');
  if(l) l.classList.toggle('primary',previewLayout.align==='left');
  if(c) c.classList.toggle('primary',previewLayout.align==='center');
  if(r) r.classList.toggle('primary',previewLayout.align==='right');
  const ov=$('previewOffsetVal'); if(ov) ov.textContent=previewLayout.offset+'%';
  const wv=$('previewWidthVal'); if(wv) wv.textContent=previewLayout.width+'%';
}
if($('btnAlignLeft')) $('btnAlignLeft').onclick=()=>{previewLayout.align='left';applyPreviewLayout();};
if($('btnAlignCenter')) $('btnAlignCenter').onclick=()=>{previewLayout.align='center';applyPreviewLayout();};
if($('btnAlignRight')) $('btnAlignRight').onclick=()=>{previewLayout.align='right';applyPreviewLayout();};
if($('previewOffset')) $('previewOffset').oninput=e=>{previewLayout.offset=+e.target.value;applyPreviewLayout();};
if($('previewWidth')) $('previewWidth').oninput=e=>{previewLayout.width=+e.target.value;applyPreviewLayout();};
/* Workspace layout: adjust side panels so IMPORT (left) / SETTINGS (right) get space */
let layoutState={showLeft:true,showRight:true,leftW:230,rightW:280,theater:false};
function applyLayout(){
  const main=document.querySelector('main.layout');
  const lp=document.querySelector('.import-panel'), rp=document.querySelector('.settings-panel');
  const showL=layoutState.showLeft&&!layoutState.theater, showR=layoutState.showRight&&!layoutState.theater;
  setPanelSmooth(lp,showL,'L');
  setPanelSmooth(rp,showR,'R');
  if(main){
    if(window.innerWidth<=1000){ main.style.gridTemplateColumns=''; main.style.gap=''; }
    else{
      main.style.gridTemplateColumns=(showL?layoutState.leftW+'px':'0px')+' 1fr '+(showR?layoutState.rightW+'px':'0px');
      main.style.gap=(showL||showR)?'10px':'0';
    }
  }
  const tl=$('btnToggleLeft'); if(tl) tl.classList.toggle('primary',showL);
  const tr=$('btnToggleRight'); if(tr) tr.classList.toggle('primary',showR);
  const sb=$('btnSettingsBar'); if(sb) sb.classList.toggle('active',showR);
  const th=$('btnTheater'); if(th) th.classList.toggle('primary',layoutState.theater);
  const lw=$('leftWidthVal'); if(lw) lw.textContent=layoutState.leftW+'px';
  const rw=$('rightWidthVal'); if(rw) rw.textContent=layoutState.rightW+'px';
  if($('leftWidth')&&document.activeElement!==$('leftWidth')) $('leftWidth').value=layoutState.leftW;
  if($('rightWidth')&&document.activeElement!==$('rightWidth')) $('rightWidth').value=layoutState.rightW;
}
/* Smooth panel show/hide: fade + slide first, display:none only after the animation */
const panelHideTimers={};
function setPanelSmooth(el,show,key){
  if(!el) return;
  if(panelHideTimers[key]){ clearTimeout(panelHideTimers[key]); panelHideTimers[key]=null; }
  if(show){
    el.classList.remove('panel-gone');
    void el.offsetWidth; // reflow so the fade-in transition plays
    requestAnimationFrame(()=>requestAnimationFrame(()=>el.classList.remove('panel-hidden')));
  }else{
    if(el.classList.contains('panel-gone')) return;
    el.classList.add('panel-hidden');
    panelHideTimers[key]=setTimeout(()=>{ el.classList.add('panel-gone'); panelHideTimers[key]=null; },370);
  }
}
/* While dragging a width slider the grid follows instantly (no trailing lag) */
function noAnimWhileDragging(input){
  if(!input) return;
  input.addEventListener('pointerdown',()=>document.querySelector('main.layout')?.classList.add('no-anim'));
  window.addEventListener('pointerup',()=>document.querySelector('main.layout')?.classList.remove('no-anim'));
}
function setRightVisible(v){ if(layoutState.theater&&v) layoutState.theater=false; layoutState.showRight=!!v; applyLayout(); }
if($('btnToggleLeft')) $('btnToggleLeft').onclick=()=>{ layoutState.theater=false; layoutState.showLeft=!layoutState.showLeft; applyLayout(); };
if($('btnToggleRight')) $('btnToggleRight').onclick=()=>setRightVisible(!(layoutState.showRight&&!layoutState.theater));
if($('btnTheater')) $('btnTheater').onclick=()=>{ layoutState.theater=!layoutState.theater; applyLayout(); };
if($('leftWidth')) $('leftWidth').oninput=e=>{ layoutState.leftW=+e.target.value; applyLayout(); };
if($('rightWidth')) $('rightWidth').oninput=e=>{ layoutState.rightW=+e.target.value; applyLayout(); };
noAnimWhileDragging($('leftWidth'));
noAnimWhileDragging($('rightWidth'));
if($('btnSettingsBar')) $('btnSettingsBar').onclick=()=>{
  if(layoutState.theater){ layoutState.theater=false; layoutState.showRight=true; }
  else layoutState.showRight=!layoutState.showRight;
  applyLayout();
};
/* One settings icon: every settings section collapses/expands from its title */
(function collapsibleSettings(){
  document.querySelectorAll('.settings-panel .set-group').forEach(g=>{
    const first=g.querySelector(':scope > label');
    if(!first||first.classList.contains('sg-toggle')) return;
    first.classList.add('sg-toggle');
    first.title='Click to expand / collapse this section';
    const arrow=document.createElement('span'); arrow.className='sg-arrow'; arrow.textContent='▾';
    first.prepend(arrow);
    first.addEventListener('click',e=>{ if(e.target.closest('button,input,select')) return; g.classList.toggle('collapsed'); });
  });
  const h=document.querySelector('.settings-panel h2');
  if(h&&!h.querySelector('.sg-all')){
    const wrap=document.createElement('span'); wrap.className='sg-all';
    wrap.innerHTML='<button id="btnSgCollapse" title="Collapse all sections">- All</button><button id="btnSgExpand" title="Expand all sections">+ All</button>';
    h.append(wrap);
    wrap.querySelector('#btnSgCollapse').onclick=()=>document.querySelectorAll('.settings-panel .set-group').forEach(g=>g.classList.add('collapsed'));
    wrap.querySelector('#btnSgExpand').onclick=()=>document.querySelectorAll('.settings-panel .set-group').forEach(g=>g.classList.remove('collapsed'));
  }
})();
$('fadeIn').onchange=e=>{const c=selClip();if(!c)return;pushHistory();c.fadeIn=Math.max(0,+e.target.value);};
$('fadeOut').onchange=e=>{const c=selClip();if(!c)return;pushHistory();c.fadeOut=Math.max(0,+e.target.value);};
$('btnApplyTrim').onclick=applyTrim;
$('btnTrim').onclick=applyTrim;
function applyTrim(){
  const c=selClip(); if(!c) return alert('Select a clip first');
  let s=parseFloat($('trimStart').value), e2=parseFloat($('trimEnd').value);
  if(isNaN(s)||isNaN(e2)||s<0||e2> c.duration||s>=e2) return alert(`Invalid trim. Must be 0 ≤ start < end ≤ ${c.duration.toFixed(1)}`);
  pushHistory(); c.trimStart=s; c.trimEnd=e2; pause(); syncAll();
}
// text editor bindings (edit + size customize + animation)
function selText(){ return textOverlays.find(x=>x.id===selectedTextId)||null; }
function selImage(){ return imageOverlays.find(x=>x.id===selectedImageId)||null; }
function setTextSize(v){
  const t=selText(); if(!t) return;
  t.size=Math.max(12,Math.min(200,Math.round(v)));
  $('textSize').value=t.size; $('textSizeSlider').value=t.size; $('textSizeVal').textContent=t.size+'px';
  patchTextNode(t.id);
}
$('textContent').oninput=e=>{const t=selText();if(t){t.text=e.target.value;patchTextNode(t.id);renderTimeline();}};
$('textColor').oninput=e=>{const t=selText();if(t){t.color=e.target.value;patchTextNode(t.id);}};
$('textSize').oninput=e=>{const t=selText();if(t){setTextSize(+e.target.value||48);}};
$('textSize').onchange=()=>pushHistory();
$('textSizeSlider').oninput=e=>{const t=selText();if(!t)return;setTextSize(+e.target.value);};
$('textSizeSlider').onchange=()=>pushHistory();
$('btnTextMinus').onclick=()=>{const t=selText();if(!t)return;pushHistory();setTextSize(t.size-6);};
$('btnTextPlus').onclick=()=>{const t=selText();if(!t)return;pushHistory();setTextSize(t.size+6);};
$('textFont').onchange=e=>{const t=selText();if(!t)return;pushHistory();t.font=e.target.value;patchTextNode(t.id);};
$('btnTextBold').onclick=()=>{const t=selText();if(!t)return;pushHistory();t.bold=!t.bold;syncSettings();patchTextNode(t.id);};
$('btnTextItalic').onclick=()=>{const t=selText();if(!t)return;pushHistory();t.italic=!t.italic;syncSettings();patchTextNode(t.id);};
$('textBg').oninput=e=>{const t=selText();if(!t)return;t.bg=e.target.value;patchTextNode(t.id);};
$('textBg').onchange=()=>pushHistory();
$('btnTextBgClear').onclick=()=>{const t=selText();if(!t)return;pushHistory();t.bg='transparent';patchTextNode(t.id);};
$('textX').oninput=e=>{const t=selText();if(!t)return;t.x=+e.target.value;patchTextNode(t.id);};
$('textX').onchange=()=>pushHistory();
$('textY').oninput=e=>{const t=selText();if(!t)return;t.y=+e.target.value;patchTextNode(t.id);};
$('textY').onchange=()=>pushHistory();
$('textAnim').onchange=e=>{const t=selText();if(!t)return;pushHistory();t.anim=e.target.value;renderTextLayer();renderTimeline();};
$('textStart').onchange=e=>{const t=selText();if(t){pushHistory();t.start=Math.max(0,+e.target.value);if(t.end<=t.start)t.end=t.start+0.5;renderTimeline();syncSettings();}};
$('textEnd').onchange=e=>{const t=selText();if(t){pushHistory();t.end=Math.max(t.start+0.5,+e.target.value);renderTimeline();syncSettings();}};
if($('textDur')) $('textDur').onchange=e=>{const t=selText();if(t){pushHistory();const d=Math.max(0.5,+e.target.value||1);t.end=t.start+d;renderTimeline();syncSettings();}};
function focusTextEditor(){ const inp=$('textContent'); if(inp){ try{inp.focus(); inp.select();}catch{} const ed=$('textEditor'); if(ed) ed.scrollIntoView({block:'nearest',behavior:'smooth'}); } }
if($('btnTextEditFocus')) $('btnTextEditFocus').onclick=focusTextEditor;
if($('btnTextEditPencil')) $('btnTextEditPencil').onclick=focusTextEditor;
// image editor bindings (resize + animation)
function setImgSize(v){
  const o=selImage(); if(!o) return;
  o.w=Math.max(5,Math.min(100,Math.round(v)));
  $('imgSizeSlider').value=o.w; $('imgSizeVal').textContent=o.w+'%';
  patchImageNode(o.id);
}
$('imgSizeSlider').oninput=e=>{if(!selImage())return;setImgSize(+e.target.value);};
$('imgSizeSlider').onchange=()=>pushHistory();
$('btnImgMinus').onclick=()=>{const o=selImage();if(!o)return;pushHistory();setImgSize(o.w-5);};
$('btnImgPlus').onclick=()=>{const o=selImage();if(!o)return;pushHistory();setImgSize(o.w+5);};
$('imgOpacity').oninput=e=>{const o=selImage();if(!o)return;o.opacity=e.target.value/100;$('imgOpVal').textContent=e.target.value+'%';patchImageNode(o.id);};
$('imgOpacity').onchange=()=>pushHistory();
$('imgAnim').onchange=e=>{const o=selImage();if(!o)return;pushHistory();o.anim=e.target.value;renderTextLayer();renderTimeline();};
$('imgStart').onchange=e=>{const o=selImage();if(o){pushHistory();o.start=Math.max(0,+e.target.value);if(o.end<=o.start)o.end=o.start+0.5;renderTimeline();syncSettings();}};
$('imgEnd').onchange=e=>{const o=selImage();if(o){pushHistory();o.end=Math.max(o.start+0.5,+e.target.value);renderTimeline();syncSettings();}};
if($('imgDur')) $('imgDur').onchange=e=>{const o=selImage();if(o){pushHistory();const d=Math.max(0.5,+e.target.value||1);o.end=o.start+d;renderTimeline();syncSettings();}};

/* ---------- playback (top toolbar) ---------- */
$('btnPlay').onclick=togglePlay;
function togglePlay(){ if(!clips.length && !audioClips.length) return alert('Import a video first'); playing?pause():play(); }
function play(){
  video.muted=false;
  const found=clipAt(globalTime);
  if(!found && clips.length){ globalTime=0; }
  if(clips.length && globalTime>=totalDur()) globalTime=0;
  playing=true; $('btnPlay').textContent='⏸ Pause'; lastTick=performance.now();
  if(bgMusicName){ bgAudio.play().catch(()=>{}); }
  syncAudios(true);
}
function pause(){ playing=false; $('btnPlay').textContent='▶ Play'; video.pause(); bgAudio.pause(); audioClips.forEach(a=>{try{a.el&&a.el.pause();}catch{}}); }
function seek(t){ const lim = clips.length?totalDur():Math.max(10,...audioClips.map(a=>a.end),...textOverlays.map(o=>o.end),...imageOverlays.map(o=>o.end),0); globalTime=Math.min(Math.max(0,t),lim); syncVideoToTime(); syncAudios(false); updateTimeUI(); renderTextLayer(); }
/* MULTI AUDIO sync: each clip plays inside its own [start,end] window */
function syncAudios(forcePlay){
  const wantPlay = forcePlay??playing;
  audioClips.forEach(a=>{
    const el=getAudioEl(a);
    el.volume=Math.max(0,Math.min(1,a.volume*($('musicVolume')?$('musicVolume').value/100||0.5:0.5)));
    const inside = globalTime>=a.start && globalTime<a.end;
    if(inside){
      const wantT=(globalTime-a.start)%Math.max(0.1,a.duration||(a.end-a.start));
      if(Math.abs((el.currentTime||0)-wantT)>0.4){ try{el.currentTime=wantT;}catch{} }
      if(wantPlay && el.paused){ el.play().catch(()=>{}); }
      if(!wantPlay && !el.paused){ el.pause(); }
    } else {
      if(!el.paused) el.pause();
    }
  });
}

$('seekBar').addEventListener('pointerdown',()=>seekDragging=true);
window.addEventListener('pointerup',()=>seekDragging=false);
$('seekBar').oninput=e=>{ seek(e.target.value/1000*totalDur()); };

// single-frame stepping
function stepFrame(dir){ if(!clips.length) return; pause(); seek(globalTime+dir*FRAME_DUR); }
$('btnPrevFrame').onclick=()=>stepFrame(-1);
$('btnNextFrame').onclick=()=>stepFrame(1);
$('btnFrameBack').onclick=()=>stepFrame(-1);
$('btnFrameFwd').onclick=()=>stepFrame(1);

// keyboard shortcuts
window.addEventListener('keydown',e=>{
  /* disable shortcuts while typing in a form field (text edit safe) */
  const tag=e.target&&(e.target.tagName||'');
  if(tag==='INPUT'||tag==='SELECT'||tag==='TEXTAREA'||e.target.isContentEditable) return;
  if(e.code==='Space'){ e.preventDefault(); togglePlay(); }
  else if(e.key==='ArrowLeft'){ stepFrame(-1); }
  else if(e.key==='ArrowRight'){ stepFrame(1); }
  else if(e.key==='+'||e.key==='='){ setZoom(pxPerSec+40); }
  else if(e.key==='-'||e.key==='_'){ setZoom(pxPerSec-40); }
  else if(e.key==='0'&&e.ctrlKey){ e.preventDefault(); $('btnZoomFit').click(); }
  else if((e.key==='s'||e.key==='S')&&!e.ctrlKey){ splitAtPlayhead(); }
  else if((e.key==='z'||e.key==='Z')&&(e.ctrlKey||e.metaKey)){ e.preventDefault(); undo(); }
});

function syncVideoToTime(){
  const found=clipAt(globalTime);
  if(!found){ video.pause(); return; }
  const {clip,offset}=found;
  const vt = clip.trimStart + offset*clip.speed;
  if(video.src!==clip.url){ video.src=clip.url; video.playbackRate=clip.speed; video.volume=clip.volume; }
  if(Math.abs(video.currentTime-vt)>0.35){ video.currentTime=Math.min(vt,clip.trimEnd-0.05); }
  video.playbackRate=clip.speed; video.volume=clip.volume;
  if(playing){ video.play().catch(()=>{}); }
}

/* ---------- filter strength scaling ---------- */
function scaleFilterStr(filter, strength){
  if(!filter||filter==='none'||strength>=100) return filter||'';
  if(strength<=0) return '';
  const f=strength/100;
  return filter.replace(/([a-z-]+)\(([^)]+)\)/gi,(m,fn,args)=>{
    if(/hue-rotate/i.test(fn)){
      const deg=parseFloat(args);
      if(isNaN(deg)) return m;
      return `${fn}(${deg*f}deg)`;
    }
    if(/blur/i.test(fn)){
      const px=parseFloat(args);
      if(isNaN(px)) return m;
      return `${fn}(${(px*f).toFixed(2)}px)`;
    }
    // percent based: grayscale/sepia/invert/saturate/contrast/brightness
    const pct=parseFloat(args);
    if(isNaN(pct)) return m;
    // interpolate toward neutral: 100% funcs toward 0% (none), saturate/contrast/brightness toward 100%
    let neutral = /saturate|contrast|brightness/i.test(fn)?100:0;
    const v = neutral+(pct-neutral)*f;
    const unit = args.includes('%')?'%':'';
    return `${fn}(${v.toFixed(1)}${unit})`;
  });
}

/* ---------- drawing (single unified frame + scale + mask + keyframes + effects + transitions) ---------- */
function applyMaskClip(targetCtx, clip, W, H){
  if(!clip.mask || clip.mask==='none') return;
  targetCtx.beginPath();
  if(clip.mask==='circle'){
    const r=(clip.maskSize/100)*(Math.min(W,H)/2);
    targetCtx.arc(W*clip.maskX/100, H*clip.maskY/100, r, 0, Math.PI*2);
  } else if(clip.mask==='rect'){
    const w=W*clip.maskSize/100, h=H*clip.maskSize/100;
    targetCtx.rect(W*clip.maskX/100-w/2, H*clip.maskY/100-h/2, w, h);
  } else if(clip.mask==='left'){ targetCtx.rect(0,0,W/2,H); }
  else if(clip.mask==='right'){ targetCtx.rect(W/2,0,W/2,H); }
  else if(clip.mask==='top'){ targetCtx.rect(0,0,W,H/2); }
  else if(clip.mask==='bottom'){ targetCtx.rect(0,H/2,W,H/2); }
  targetCtx.clip();
}
function drawClipFrame(targetCtx, vidEl, clip, W, H, timeInClip){
  ensureClipDefaults(clip);
  const anim=animatedProps(clip, timeInClip);
  let curScale=anim.scale, curOpacity=anim.opacity;
  /* EFFECT pre-compute (loops across the whole clip) */
  const eff = clip.effect||'none';
  let shakeX=0, shakeY=0, mirrorFlip=false, flashAmt=0, rotEff=0, hueEff=0, satEff=null;
  if(eff==='shake'){ shakeX=(Math.random()-0.5)*Math.max(6,W*0.02); shakeY=(Math.random()-0.5)*Math.max(6,H*0.02); }
  else if(eff==='pulse'){ curScale*=1+0.06*Math.sin(timeInClip*6); }
  else if(eff==='pop'){ const ph=(timeInClip*3)%1; curScale*=1+0.12*Math.abs(Math.sin(ph*Math.PI)); }
  else if(eff==='flash'){ flashAmt=Math.max(0,Math.sin(timeInClip*12))*0.35; }
  else if(eff==='mirror'){ mirrorFlip=true; }
  else if(eff==='slowZoom'){ curScale*=1+0.12*Math.min(1,timeInClip/Math.max(0.5,effDur(clip))); }
  else if(eff==='slowZoomOut'){ curScale*=1.14-0.14*Math.min(1,timeInClip/Math.max(0.5,effDur(clip))); }
  else if(eff==='driftL'){ shakeX+=Math.sin(timeInClip*0.9)*W*0.02; }
  else if(eff==='floatY'){ shakeY+=Math.sin(timeInClip*1.6)*H*0.02; }
  else if(eff==='wiggle'){ rotEff=Math.sin(timeInClip*5)*0.035; }
  else if(eff==='sway'){ rotEff=Math.sin(timeInClip*1.8)*0.06; shakeX+=Math.sin(timeInClip*1.8)*W*0.015; }
  else if(eff==='breathe'){ curOpacity*=0.88+0.12*Math.sin(timeInClip*2.2)*0.5+0.12; }
  else if(eff==='blink'){ curOpacity*=0.55+0.45*Math.abs(Math.sin(timeInClip*2.4)); }
  else if(eff==='spinSlow'){ rotEff=timeInClip*0.35; }
  else if(eff==='hueCycle'){ hueEff=(timeInClip*40)%360; }
  else if(eff==='satPulse'){ satEff=100+90*Math.sin(timeInClip*3); }
  else if(eff==='glitchLoop'){ if((timeInClip%1.6)<0.18){ shakeX+=(Math.random()-0.5)*W*0.05; flashAmt=Math.max(flashAmt,0.15); } }
  else if(eff==='strobeLoop'){ flashAmt=Math.max(flashAmt,(Math.sin(timeInClip*18)>0?0.5:0.04)); }
  else if(eff==='bounceLoop'){ shakeY+=-Math.abs(Math.sin(timeInClip*4))*H*0.03; }
  else if(eff==='heartbeatLoop'){ curScale*=1+0.09*Math.sin(timeInClip*6)+0.04*Math.sin(timeInClip*12); }
  else if(eff==='jitter'){ shakeX+=(Math.random()-0.5)*4; shakeY+=(Math.random()-0.5)*4; }
  else if(eff==='vintageFlicker'){ curOpacity*=0.92+0.08*Math.sin(timeInClip*30)+((Math.random()-0.5)*0.04); flashAmt=Math.max(flashAmt,Math.random()<0.03?0.12:0); }
  /* TRANSITION IN + OUT (between-clips: OUT of current into IN of next). p: 0=start → 1=done for IN, reversed for OUT */
  const TAU = Math.PI*2;
  const remain0 = effDur(clip)-timeInClip;
  const outTr = clip.outTransition||'none';
  const outDur = Math.max(0.05, clip.outTransDur||0.5);
  let tr = clip.transition||'none';
  let tDur = Math.max(0.05, clip.transDur||0.5);
  let transF = 1;
  if(outTr!=='none' && remain0<outDur){ tr=outTr; tDur=outDur; transF=Math.max(0,Math.min(1,remain0/outDur)); }
  else if(tr!=='none' && timeInClip<tDur){ transF=Math.max(0,Math.min(1,timeInClip/tDur)); }
  else { tr='none'; }
  const q = 1-transF;
  let slideX=0, slideY=0, rotAdd=0, alphaMulT=1, scaleMulT=1, blurT=0, flipSX=1, flipSY=1, shakeT=0;
  let flashColor=null, flashAlpha=0, wipeDir=null, shapeMode=null, glitchBars=false, leakAlpha=0;
  if(tr!=='none' && transF<1){
    const p=transF;
    switch(tr){
      // ---- Fade ----
      case 'fade': alphaMulT=p; break;
      case 'fadeZoom': alphaMulT=p; scaleMulT=0.6+0.4*p; break;
      case 'fadeSlideL': alphaMulT=p; slideX=-W*0.25*q; break;
      case 'fadeSlideR': alphaMulT=p; slideX=W*0.25*q; break;
      case 'fadeSlideU': alphaMulT=p; slideY=-H*0.25*q; break;
      case 'fadeSlideD': alphaMulT=p; slideY=H*0.25*q; break;
      case 'fadeSpin': alphaMulT=p; rotAdd=q*1.5; scaleMulT=0.7+0.3*p; break;
      case 'fadeBlur': alphaMulT=p; blurT=12*q; break;
      // ---- Slide ----
      case 'slideL': slideX=-W*q; break;
      case 'slideR': slideX=W*q; break;
      case 'slideU': slideY=-H*q; break;
      case 'slideD': slideY=H*q; break;
      case 'slideTL': slideX=-W*q; slideY=-H*q; break;
      case 'slideTR': slideX=W*q; slideY=-H*q; break;
      case 'slideBL': slideX=-W*q; slideY=H*q; break;
      case 'slideBR': slideX=W*q; slideY=H*q; break;
      // ---- Zoom ----
      case 'zoom': scaleMulT=0.5+0.5*p; break;
      case 'zoomOut': scaleMulT=2-p; break;
      case 'zoomBounce': scaleMulT=0.3+0.7*easeOutBack(p); break;
      case 'zoomSpin': scaleMulT=0.4+0.6*p; rotAdd=q*TAU; break;
      case 'zoomSlideU': scaleMulT=0.5+0.5*p; slideY=H*0.3*q; break;
      case 'zoomFlash': scaleMulT=0.5+0.5*p; flashColor='#fff'; flashAlpha=0.8*q; break;
      // ---- Spin ----
      case 'spinCW': rotAdd=q*TAU; alphaMulT=p; break;
      case 'spinCCW': rotAdd=-q*TAU; alphaMulT=p; break;
      case 'spinBlur': rotAdd=q*Math.PI; blurT=8*q; alphaMulT=p; break;
      case 'spinFade': rotAdd=q*Math.PI; alphaMulT=p*p; break;
      // ---- Flip ----
      case 'flipH': flipSX=-Math.cos(p*Math.PI); break;
      case 'flipV': flipSY=-Math.cos(p*Math.PI); break;
      case 'flipFade': flipSX=-Math.cos(p*Math.PI); alphaMulT=p; break;
      // ---- Wipe ----
      case 'wipeL': wipeDir='L'; break;
      case 'wipeR': wipeDir='R'; break;
      case 'wipeU': wipeDir='U'; break;
      case 'wipeD': wipeDir='D'; break;
      // ---- Shape ----
      case 'irisIn': shapeMode='iris'; break;
      case 'circlePop': shapeMode='circlePop'; break;
      case 'squareIn': shapeMode='square'; break;
      // ---- Bounce ----
      case 'bounceIn': slideY=-H*0.45*(1-easeOutBounce(p)); alphaMulT=p; break;
      case 'elasticIn': scaleMulT=0.5+0.5*easeOutElastic(p); alphaMulT=p; break;
      case 'dropIn': slideY=-H*0.7*q*q; alphaMulT=Math.min(1,p*2); break;
      case 'popIn': scaleMulT=Math.max(0.2,0.2+0.8*easeOutBack(p)); alphaMulT=p; break;
      // ---- Blur / Glow ----
      case 'blurIn': blurT=14*q; alphaMulT=p; break;
      case 'glowIn': flashColor='#fff'; flashAlpha=0.7*q; alphaMulT=p; break;
      case 'softIn': blurT=6*q; alphaMulT=p; break;
      // ---- Flash / Glitch ----
      case 'white': flashColor='#fff'; flashAlpha=q; break;
      case 'black': flashColor='#000'; flashAlpha=q; break;
      case 'strobe': flashColor='#fff'; flashAlpha=(Math.sin(p*25)>0?0.55:0.08)*q+0.05*q; break;
      case 'glitch': shakeT=Math.max(6,W*0.02)*q; glitchBars=true; break;
      case 'shakeIn': shakeT=Math.max(6,W*0.02)*q; alphaMulT=p; break;
      case 'flicker': alphaMulT=p*(0.55+0.45*Math.sin(p*30)); break;
      // ---- Cinematic ----
      case 'mirrorL': flipSX=-1; slideX=-W*q; break;
      case 'mirrorR': flipSX=-1; slideX=W*q; break;
      case 'rollIn': rotAdd=q*0.7; slideX=-W*0.45*q; alphaMulT=p; break;
      case 'swingIn': rotAdd=Math.sin(q*Math.PI*3)*q*0.45; alphaMulT=p; break;
      // ---- Extra ----
      case 'heartbeat': scaleMulT=1+0.28*Math.sin(p*Math.PI*2)*q; alphaMulT=0.2+0.8*p; break;
      case 'floatUp': slideY=H*0.35*q; alphaMulT=p*p; scaleMulT=0.92+0.08*p; break;
      // ---- Fade extra ----
      case 'fadeZoomOut': alphaMulT=p; scaleMulT=1.4-0.4*p; break;
      case 'fadeFlip': alphaMulT=p; flipSX=-Math.cos(p*Math.PI); break;
      case 'fadeBounce': alphaMulT=p; slideY=-H*0.3*(1-easeOutBounce(p)); break;
      case 'fadeGlow': alphaMulT=p; flashColor='#fff'; flashAlpha=0.6*q; break;
      // ---- Slide extra ----
      case 'slideBounceL': slideX=-W*q; slideY=-H*0.12*(1-easeOutBounce(p)); break;
      case 'slideBounceR': slideX=W*q; slideY=-H*0.12*(1-easeOutBounce(p)); break;
      case 'slideElasticU': slideY=-H*q; scaleMulT=0.7+0.3*easeOutElastic(p); break;
      case 'slideSpin': slideX=-W*0.6*q; rotAdd=q*Math.PI; alphaMulT=p; break;
      // ---- Zoom extra ----
      case 'crashZoom': scaleMulT=2.6-1.6*easeOutBack(p); alphaMulT=Math.min(1,p*2); break;
      case 'zoomPanL': scaleMulT=0.6+0.4*p; slideX=-W*0.2*q; break;
      case 'zoomPanR': scaleMulT=0.6+0.4*p; slideX=W*0.2*q; break;
      case 'zoomOutSpin': scaleMulT=2-p; rotAdd=q*Math.PI; break;
      // ---- Spin extra ----
      case 'tiltSpin': rotAdd=q*0.9; scaleMulT=0.75+0.25*p; alphaMulT=p; break;
      case 'spinZoomOut': rotAdd=q*TAU; scaleMulT=2-p; alphaMulT=p; break;
      // ---- Flip extra ----
      case 'flipSpin': flipSX=-Math.cos(p*Math.PI); rotAdd=q*Math.PI; break;
      case 'flipBounce': flipSX=-Math.cos(p*Math.PI); slideY=-H*0.15*(1-easeOutBounce(p)); break;
      // ---- Wipe extra ----
      case 'wipeCenter': wipeDir='C'; break;
      case 'wipeDiagTL': slideX=-W*0.5*q; slideY=-H*0.5*q; alphaMulT=p; wipeDir='L'; break;
      case 'wipeDiagBR': slideX=W*0.5*q; slideY=H*0.5*q; alphaMulT=p; wipeDir='R'; break;
      case 'wipeBounce': wipeDir='L'; slideY=-H*0.1*(1-easeOutBounce(p)); break;
      // ---- Shape extra ----
      case 'diamondIn': shapeMode='diamond'; break;
      case 'barReveal': shapeMode='bar'; break;
      // ---- Bounce extra ----
      case 'jellyIn': scaleMulT=0.4+0.6*easeOutElastic(p); rotAdd=Math.sin(q*Math.PI*2)*q*0.1; alphaMulT=p; break;
      case 'swingDrop': slideY=-H*0.5*q*q; rotAdd=Math.sin(q*Math.PI*3)*q*0.4; alphaMulT=Math.min(1,p*2); break;
      // ---- Blur extra ----
      case 'pixelIn': blurT=16*q; scaleMulT=1.2-0.2*p; alphaMulT=p; break;
      case 'focusPull': blurT=10*Math.sin(p*Math.PI); scaleMulT=0.94+0.06*p; break;
      // ---- Flash extra ----
      case 'lightLeak': leakAlpha=0.75*q; alphaMulT=0.25+0.75*p; scaleMulT=1.06-0.06*p; break;
      case 'lensFlash': flashColor='#fff'; flashAlpha=Math.sin(p*Math.PI)*0.9; scaleMulT=0.9+0.1*p; break;
      case 'rgbSplit': shakeT=Math.max(8,W*0.03)*q; glitchBars=true; flashAlpha=0; break;
      case 'neonFlicker': alphaMulT=p*(0.5+0.5*Math.abs(Math.sin(p*22))); flashColor='#cfe8ff'; flashAlpha=0.25*q*Math.abs(Math.sin(p*22)); break;
      // ---- Cinematic extra ----
      case 'dollyIn': scaleMulT=1.25-0.25*p; slideY=H*0.08*q; break;
      case 'panLeft': slideX=-W*0.35*q; scaleMulT=1.1; break;
      case 'panRight': slideX=W*0.35*q; scaleMulT=1.1; break;
      case 'filmFlicker': alphaMulT=0.7+0.3*p+0.1*Math.sin(p*40)*q; blurT=2*q; shakeT=4*q; break;
      // ---- Extra ----
      case 'swirlIn': rotAdd=q*TAU*1.2; scaleMulT=0.3+0.7*p; alphaMulT=p; blurT=6*q; break;
      case 'rippleIn': scaleMulT=0.7+0.3*p+0.06*Math.sin(p*12)*q; alphaMulT=p; break;
      case 'tornadoSpin': rotAdd=q*TAU*2; slideY=H*0.4*q; scaleMulT=0.5+0.5*p; alphaMulT=p; break;
    }
  }
  if(shakeT>0){ shakeX+=(Math.random()-0.5)*shakeT; shakeY+=(Math.random()-0.5)*shakeT; }
  curScale*=scaleMulT; curOpacity*=alphaMulT;

  targetCtx.save();
  targetCtx.fillStyle='#000'; targetCtx.fillRect(0,0,W,H);
  // mask region + transition wipe/shape reveal
  targetCtx.save();
  applyMaskClip(targetCtx, clip, W, H);
  if(wipeDir && transF<1){
    targetCtx.beginPath();
    if(wipeDir==='L') targetCtx.rect(0,0,Math.max(1,W*transF),H);
    else if(wipeDir==='R') targetCtx.rect(W-Math.max(1,W*transF),0,Math.max(1,W*transF),H);
    else if(wipeDir==='U') targetCtx.rect(0,0,W,Math.max(1,H*transF));
    else if(wipeDir==='C'){ const w2=Math.max(1,W*transF),h2=Math.max(1,H*transF); targetCtx.rect(W/2-w2/2,H/2-h2/2,w2,h2); }
    else targetCtx.rect(0,H-Math.max(1,H*transF),W,Math.max(1,H*transF));
    targetCtx.clip();
  }
  if(shapeMode && transF<1){
    targetCtx.beginPath();
    const m=Math.max(W,H);
    if(shapeMode==='iris'){ targetCtx.arc(W/2,H/2,Math.max(1,m*0.75*transF),0,Math.PI*2); }
    else if(shapeMode==='circlePop'){ const e=Math.max(0.01,easeOutBack(transF)); targetCtx.arc(W/2,H/2,Math.max(1,m*0.75*e),0,Math.PI*2); }
    else if(shapeMode==='diamond'){ const r=Math.max(1,m*0.75*Math.max(0.01,transF)); targetCtx.moveTo(W/2,H/2-r); targetCtx.lineTo(W/2+r,H/2); targetCtx.lineTo(W/2,H/2+r); targetCtx.lineTo(W/2-r,H/2); targetCtx.closePath(); }
    else if(shapeMode==='bar'){ const bh=Math.max(1,H*transF); targetCtx.rect(0,H/2-bh/2,W,bh); }
    else { const w2=Math.max(1,W*transF),h2=Math.max(1,H*transF); targetCtx.rect(W/2-w2/2,H/2-h2/2,w2,h2); }
    targetCtx.clip();
  }
  // fade + opacity + keyframes + transition
  let alpha=curOpacity;
  const remain = effDur(clip)-timeInClip;
  if(clip.fadeIn>0 && timeInClip<clip.fadeIn) alpha*=Math.max(0,timeInClip/clip.fadeIn);
  if(clip.fadeOut>0 && remain<clip.fadeOut) alpha*=Math.max(0,remain/clip.fadeOut);
  targetCtx.globalAlpha=Math.max(0,Math.min(1,alpha));
  const scaledFilter=scaleFilterStr(clip.filter, clip.filterStrength);
  try{ targetCtx.filter=`brightness(${clip.brightness}%) contrast(${clip.contrast}%) ${scaledFilter||''}${satEff!=null?` saturate(${Math.max(0,satEff).toFixed(0)}%)`:''}${hueEff?` hue-rotate(${hueEff.toFixed(0)}deg)`:''}${blurT>0.05?` blur(${blurT.toFixed(1)}px)`:''}`.trim(); }catch{}
  // position + rotate + scale + fit + effect/transition offsets
  targetCtx.translate(W/2 + clip.posX/100*W + shakeX + slideX, H/2 + clip.posY/100*H + shakeY);
  targetCtx.rotate(clip.rotate*Math.PI/180 + rotAdd + rotEff);
  targetCtx.scale((mirrorFlip?-1:1)*flipSX, flipSY);
  const rot = ((clip.rotate%180)+180)%180!==0;
  const cw = rot?H:W, ch = rot?W:H;
  const vw = vidEl.videoWidth||16, vh = vidEl.videoHeight||9;
  const k = curScale/100;
  if(clip.fit==='stretch'){
    targetCtx.drawImage(vidEl,-cw*k/2,-ch*k/2,cw*k,ch*k);
  } else {
    const s = clip.fit==='contain' ? Math.min(cw/vw, ch/vh) : Math.max(cw/vw, ch/vh);
    const dw=vw*s*k, dh=vh*s*k;
    targetCtx.drawImage(vidEl,-dw/2,-dh/2,dw,dh);
  }
  targetCtx.restore(); // mask clip
  /* transition overlays (flash / leak / glitch) + effect flash */
  if(flashColor && flashAlpha>0.01){ targetCtx.save(); targetCtx.globalAlpha=Math.min(1,flashAlpha); targetCtx.fillStyle=flashColor; targetCtx.fillRect(0,0,W,H); targetCtx.restore(); }
  if(leakAlpha>0.01){ targetCtx.save(); targetCtx.globalAlpha=Math.min(1,leakAlpha); targetCtx.fillStyle='#ff6a00'; targetCtx.fillRect(0,0,W,H); targetCtx.restore(); }
  if(glitchBars){
    targetCtx.save(); targetCtx.globalAlpha=0.55;
    for(let g=0;g<3;g++){
      targetCtx.fillStyle=Math.random()<0.5?'#000':'#fff';
      const gy=Math.random()*H, gh=4+Math.random()*18;
      targetCtx.fillRect(0,gy,W,gh);
    }
    targetCtx.restore();
  }
  if(flashAmt>0){ targetCtx.save(); targetCtx.globalAlpha=flashAmt; targetCtx.fillStyle='#fff'; targetCtx.fillRect(0,0,W,H); targetCtx.restore(); }
  targetCtx.restore();
  targetCtx.globalAlpha=1;
  try{targetCtx.filter='none';}catch{}
}
function drawImageOverlaysTo(targetCtx,W,H,scale=1){
  imageOverlays.forEach(o=>{
    if(globalTime<o.start||globalTime>o.end||!o.img||!o.img.complete) return;
    targetCtx.save(); targetCtx.globalAlpha=o.opacity;
    const w=W*o.w/100, h=w*(o.img.height/o.img.width);
    targetCtx.drawImage(o.img, W*o.x/100, H*o.y/100, w,h);
    targetCtx.restore();
  });
}
/* Text/image preview layer — differential render.
   Rebuilding the DOM restarts CSS animations, so nodes are only
   created/removed when visibility, selection or animation changes.
   Style/content edits patch the live node in place (no glitch). */
let textLayerCache='';
const textSig=o=>[o.id,o.text,o.color,o.size,o.x,o.y,o.font,o.bold,o.italic,o.bg,o.anim,o.start,o.end].join('|');
const imgSig=o=>[o.id,o.x,o.y,o.w,o.opacity,o.anim,o.start,o.end,o.name].join('|');
function textLayerSig(){
  const t=textOverlays.filter(o=>globalTime>=o.start&&globalTime<=o.end).map(textSig).join('~');
  const im=imageOverlays.filter(o=>globalTime>=o.start&&globalTime<=o.end).map(imgSig).join('~');
  return t+'#'+im+'#sel:'+selectedTextId+','+selectedImageId+'#w:'+Math.round(canvas.clientWidth/5);
}
function buildTextNode(o,sel){
  const d=document.createElement('div');
  d.dataset.oid='t'+o.id; d.dataset.sel=String(sel); d.dataset.anim=o.anim;
  d.className='t-overlay'+(sel?' selected':'')+(o.anim!=='none'?' anim-'+o.anim:'');
  const span=document.createElement('span'); span.className='t-text'; span.textContent=o.text; d.append(span);
  syncTextNode(d,o);
  makeDraggable(d,o,'text');
  if(sel){
    addResizeHandle(d,o,'text');
    const pen=document.createElement('button'); pen.className='edit-pencil'; pen.textContent='✏️'; pen.title='Edit text';
    pen.onpointerdown=(e)=>{ e.preventDefault(); e.stopPropagation(); selectedTextId=o.id; selectedImageId=null; syncSettings(); renderTimeline(); renderTextLayer(); focusTextEditor(); };
    pen.onclick=(e)=>{ e.stopPropagation(); focusTextEditor(); };
    d.append(pen);
  }
  return d;
}
function syncTextNode(d,o){
  /* in-place sync only — never rewrites className, so running CSS animations keep playing */
  const span=d.querySelector('.t-text'); if(span && span.textContent!==o.text) span.textContent=o.text;
  d.style.left=o.x+'%'; d.style.top=o.y+'%'; d.style.color=o.color;
  d.style.fontSize=(o.size*canvas.clientWidth/1280)+'px';
  d.style.fontFamily=o.font||'Arial';
  d.style.fontWeight=o.bold?'bold':'normal';
  d.style.fontStyle=o.italic?'italic':'normal';
  d.style.background=(o.bg && o.bg!=='transparent')?o.bg:'transparent';
  d.classList.toggle('selected',o.id===selectedTextId);
}
function buildImageNode(o,sel){
  const d=document.createElement('div');
  d.dataset.oid='i'+o.id; d.dataset.sel=String(sel); d.dataset.anim=o.anim;
  d.className='img-overlay'+(sel?' selected':'')+(o.anim!=='none'?' anim-'+o.anim:'');
  const im=document.createElement('img'); im.src=o.url; im.style.width='100%'; im.style.display='block'; im.draggable=false;
  d.append(im);
  syncImageNode(d,o);
  makeDraggable(d,o,'image');
  if(sel) addResizeHandle(d,o,'image');
  return d;
}
function syncImageNode(d,o){
  d.style.left=o.x+'%'; d.style.top=o.y+'%'; d.style.width=o.w+'%'; d.style.aspectRatio='auto'; d.style.height='auto';
  d.style.opacity=o.opacity; d.title=o.name+' (drag to move, corner = resize)';
  d.classList.toggle('selected',o.id===selectedImageId);
}
function patchTextNode(id){
  const o=textOverlays.find(x=>x.id===id); if(!o) return;
  ensureTextDefaults(o);
  const d=textLayer.querySelector('[data-oid="t'+id+'"]');
  if(d && d.dataset.sel==String(o.id===selectedTextId) && d.dataset.anim===o.anim){ syncTextNode(d,o); textLayerCache=textLayerSig(); }
  else renderTextLayer();
}
function patchImageNode(id){
  const o=imageOverlays.find(x=>x.id===id); if(!o) return;
  ensureImageDefaults(o);
  const d=textLayer.querySelector('[data-oid="i'+id+'"]');
  if(d && d.dataset.sel==String(o.id===selectedImageId) && d.dataset.anim===o.anim){ syncImageNode(d,o); textLayerCache=textLayerSig(); }
  else renderTextLayer();
}
function renderTextLayer(force){
  const sig=textLayerSig();
  if(!force && sig===textLayerCache) return; // nothing changed — keep DOM (and animations) untouched
  textLayerCache=sig;
  const seen=new Set();
  textOverlays.forEach(o=>{
    ensureTextDefaults(o);
    if(globalTime<o.start||globalTime>o.end) return;
    seen.add('t'+o.id);
    const sel=o.id===selectedTextId;
    let d=textLayer.querySelector('[data-oid="t'+o.id+'"]');
    if(d && d.dataset.sel==String(sel) && d.dataset.anim===o.anim) syncTextNode(d,o);
    else { if(d) d.remove(); textLayer.append(buildTextNode(o,sel)); }
  });
  imageOverlays.forEach(o=>{
    ensureImageDefaults(o);
    if(globalTime<o.start||globalTime>o.end) return;
    seen.add('i'+o.id);
    const sel=o.id===selectedImageId;
    let d=textLayer.querySelector('[data-oid="i'+o.id+'"]');
    if(d && d.dataset.sel==String(sel) && d.dataset.anim===o.anim) syncImageNode(d,o);
    else { if(d) d.remove(); textLayer.append(buildImageNode(o,sel)); }
  });
  [...textLayer.children].forEach(n=>{ if(!seen.has(n.dataset.oid)) n.remove(); });
}
function makeDraggable(el,obj,kind){
  el.style.pointerEvents='auto';
  el.onpointerdown=e=>{
    if(e.target.classList&&(e.target.classList.contains('resize-handle')||e.target.classList.contains('edit-pencil'))) return;
    e.preventDefault();
    overlayDragging=true;
    if(kind==='text'){ selectedTextId=obj.id; selectedImageId=null; }
    else if(kind==='image'){ selectedImageId=obj.id; selectedTextId=null; }
    else { selectedTextId=obj.id; }
    syncSettings(); renderTimeline(); renderTextLayer();
    const fresh=textLayer.querySelector('[data-oid="'+(kind==='image'?'i':'t')+obj.id+'"]');
    if(fresh) el=fresh;
    const r=wrap.getBoundingClientRect(); const sx=e.clientX, sy=e.clientY, ox=obj.x, oy=obj.y;
    const mv=ev=>{ obj.x=Math.min(90,Math.max(0,ox+(ev.clientX-sx)/r.width*100)); obj.y=Math.min(90,Math.max(0,oy+(ev.clientY-sy)/r.height*100)); el.style.left=obj.x+'%'; el.style.top=obj.y+'%'; if(kind==='text'){const tx=$('textX');if(tx)tx.value=Math.round(obj.x);const ty=$('textY');if(ty)ty.value=Math.round(obj.y);} };
    const up=()=>{overlayDragging=false;pushHistory();renderTextLayer();window.removeEventListener('pointermove',mv);window.removeEventListener('pointerup',up);};
    window.addEventListener('pointermove',mv); window.addEventListener('pointerup',up);
  };
  /* double-click preview text focuses the settings editor for quick editing */
  if(kind==='text'){
    el.ondblclick=(e)=>{
      if(e.target.classList&&e.target.classList.contains('edit-pencil')) return;
      selectedTextId=obj.id; selectedImageId=null; syncSettings(); renderTimeline(); renderTextLayer();
      focusTextEditor();
    };
  }
}
/* corner resize handle: drag to resize emoji/sticker/text/image */
function addResizeHandle(el,obj,kind){
  const h=document.createElement('div');
  h.className='resize-handle'; h.textContent='◢'; h.title='Drag to resize';
  h.onpointerdown=e=>{
    e.preventDefault(); e.stopPropagation();
    overlayDragging=true;
    const sx=e.clientX, sy=e.clientY;
    const startSize = kind==='text'?obj.size:obj.w;
    const r=wrap.getBoundingClientRect();
    const mv=ev=>{
      const dx=(ev.clientX-sx)/r.width*100, dy=(ev.clientY-sy)/r.height*100;
      const delta=(dx+dy)/2;
      if(kind==='text'){
        obj.size=Math.max(12,Math.min(200,Math.round(startSize+delta*2)));
        el.style.fontSize=(obj.size*canvas.clientWidth/1280)+'px';
        const s=$('textSize'),sl=$('textSizeSlider'),sv=$('textSizeVal');
        if(s)s.value=obj.size; if(sl)sl.value=obj.size; if(sv)sv.textContent=obj.size+'px';
      } else {
        obj.w=Math.max(5,Math.min(100,Math.round(startSize+delta)));
        el.style.width=obj.w+'%';
        const sl=$('imgSizeSlider'),sv=$('imgSizeVal');
        if(sl)sl.value=obj.w; if(sv)sv.textContent=obj.w+'%';
      }
    };
    const up=()=>{overlayDragging=false;pushHistory();window.removeEventListener('pointermove',mv);window.removeEventListener('pointerup',up);renderTimeline();renderTextLayer();};
    window.addEventListener('pointermove',mv); window.addEventListener('pointerup',up);
  };
  el.append(h);
}

// main loop — single frame render
let lastAudioSync=0;
function loop(now){
  const dt=Math.min(0.1,(now-lastTick)/1000||0); lastTick=now;
  if(playing){
    globalTime+=dt;
    if(clips.length && globalTime>=totalDur()){ globalTime=totalDur(); pause(); }
    else syncVideoToTime();
    if(bgMusicName && bgAudio.paused && playing) bgAudio.play().catch(()=>{});
    if(now-lastAudioSync>400){ lastAudioSync=now; syncAudios(true); }
  }
  const found=clipAt(Math.min(globalTime,Math.max(0,totalDur()-0.001)));
  if(found && video.readyState>=2){
    drawClipFrame(ctx,video,found.clip,canvas.width,canvas.height,found.offset);
    drawImageOverlaysTo(ctx,canvas.width,canvas.height);
  } else if(!clips.length){
    ctx.fillStyle='#000';ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle='#555';ctx.font='24px sans-serif';ctx.textAlign='center';
    ctx.fillText('Import a video to preview',canvas.width/2,canvas.height/2);
  }
  renderTextLayerThrottled();
  updateTimeUI();
  requestAnimationFrame(loop);
}
let lastTextRender=0;
function renderTextLayerThrottled(){ if(overlayDragging) return; const n=performance.now(); if(n-lastTextRender>150){lastTextRender=n;renderTextLayer();} }
function updateTimeUI(){
  const t=`${fmt(globalTime)} / ${fmt(totalDur())}`;
  $('timeDisplay').textContent=t;
  const tb=$('toolbarTime'); if(tb) tb.textContent=t;
  if(!seekDragging) $('seekBar').value = totalDur()? Math.round(globalTime/totalDur()*1000):0;
  const fi=$('frameInfo'); if(fi) fi.textContent='Frame '+Math.round(globalTime*30)+` (${fmt(globalTime)})`;
  updatePlayhead();
  // follow playhead while playing
  if(playing){
    const sc=$('timelineScroll');
    const px=8+globalTime*pxPerSec;
    if(px<sc.scrollLeft||px>sc.scrollLeft+sc.clientWidth-60) sc.scrollLeft=Math.max(0,px-80);
  }
}

/* ---------- cut / split ---------- */
function splitAtPlayhead(){
  const found=clipAt(globalTime);
  if(!found) return alert('Nothing to cut — import video & press Play first');
  const {clip,index,offset}=found;
  const cutInClip = clip.trimStart + offset*clip.speed;
  if(offset<0.2||offset>effDur(clip)-0.2) return alert('Move playhead inside a clip (not at edges) to cut');
  pushHistory();
  const right=ensureClipDefaults({...clip,id:uid++,trimStart:cutInClip,keyframes:(clip.keyframes||[]).filter(k=>k.t>offset).map(k=>({...k,id:uid++,t:+(k.t-offset).toFixed(2)}))});
  clip.keyframes=(clip.keyframes||[]).filter(k=>k.t<=offset);
  clip.trimEnd=cutInClip;
  clips.splice(index+1,0,right);
  selectedClipId=right.id;
  syncAll();
}
$('btnCut').onclick=splitAtPlayhead;
$('btnSplitTrack').onclick=splitAtPlayhead;
$('btnUndo').onclick=undo;

/* ---------- FX DRAWER: Filter / Effect / Sticker / Emoji / Transition / Between ---------- */
let fxMode=null;
/* selected overlay quick resize + animation row (sticker/emoji drawer) */
function fxSelectedSizeRow(){
  const row=document.createElement('div'); row.className='fx-size-row';
  const t=textOverlays.find(x=>x.id===selectedTextId);
  if(!t){ row.innerHTML='<span>👆 Select a sticker/emoji first (click on preview or the TEXT track) — then adjust size/animation here</span>'; return row; }
  row.innerHTML=`<span>✏️ Selected: ${escapeHtml(t.text).slice(0,12)} • ${t.size}px</span>`;
  const minus=document.createElement('button'); minus.textContent='A−'; minus.title='Smaller';
  minus.onclick=()=>{pushHistory();t.size=Math.max(12,t.size-8);syncAll();if(fxMode)openFx(fxMode);};
  const plus=document.createElement('button'); plus.textContent='A＋'; plus.title='Bigger';
  plus.onclick=()=>{pushHistory();t.size=Math.min(200,t.size+8);syncAll();if(fxMode)openFx(fxMode);};
  const slider=document.createElement('input'); slider.type='range'; slider.min='12'; slider.max='200'; slider.value=t.size;
  slider.oninput=()=>{t.size=+slider.value;patchTextNode(t.id);};
  slider.onchange=()=>{pushHistory();syncAll();if(fxMode)openFx(fxMode);};
  const anim=document.createElement('select'); anim.title='Animation';
  TEXT_ANIMS.forEach(a=>{const op=document.createElement('option');op.value=a.v;op.textContent='🎞 '+a.n;if(t.anim===a.v)op.selected=true;anim.append(op);});
  anim.onchange=()=>{pushHistory();t.anim=anim.value;syncAll();if(fxMode)openFx(fxMode);};
  row.append(minus,slider,plus,anim);
  return row;
}
function setFxActive(btn){
  document.querySelectorAll('.fx-btn').forEach(b=>b.classList.remove('active'));
  if(btn) btn.classList.add('active');
}
function openFx(mode){
  fxMode=mode;
  const drawer=$('fxDrawer'), title=$('fxTitle'), body=$('fxBody');
  drawer.classList.remove('hidden');
  body.innerHTML='';
  if(mode==='filter'){
    setFxActive($('btnFilterBar')); title.textContent='🎨 Filters — applied to the selected video clip';
    const c=selClip();
    FILTERS.forEach(f=>{
      const b=document.createElement('button'); b.className='fx-chip'+(c&&c.filter===f.v?' active':'');
      b.innerHTML=`<span class="swatch" style="background:${f.v==='none'?'#333':''};filter:${f.v==='none'?'none':f.v};background-image:linear-gradient(45deg,#7c5cff,#2e9b4e)"></span>${f.n}`;
      b.title=f.v;
      b.onclick=()=>{ const cc=selClip(); if(!cc) return alert('Select a video clip first (click VIDEO on the timeline)'); pushHistory(); cc.filter=f.v; syncAll(); openFx('filter'); };
      body.append(b);
    });
    const note=document.createElement('p'); note.className='fx-note'; note.textContent='Tip: adjust Filter Strength in Settings (0–100%). It applies to both preview and export.';
    body.append(note);
  }
  else if(mode==='effect'){
    setFxActive($('btnEffectBar')); title.textContent=`✨ Effects (${EFFECTS.length-1}) — applied to the selected video clip`;
    const c=selClip();
    EFFECTS.forEach(f=>{
      const b=document.createElement('button'); b.className='fx-chip'+(c&&c.effect===f.v?' active':'');
      b.innerHTML=`<b>${f.n}</b><br><small>${f.d}</small>`;
      b.onclick=()=>{ const cc=selClip(); if(!cc) return alert('Select a video clip first'); pushHistory(); cc.effect=f.v; syncAll(); openFx('effect'); };
      body.append(b);
    });
    const note=document.createElement('p'); note.className='fx-note'; note.textContent='Tip: effects play live in preview and are burned into the export.';
    body.append(note);
  }
  else if(mode==='sticker'){
    setFxActive($('btnStickerBar')); title.textContent=`🌟 Animated Stickers MAX (${ANIMATED_STICKERS.length} animated + ${STICKERS.length} static + YouTube) — click to add at playhead`;
    const sec0=document.createElement('p'); sec0.className='fx-sec-title'; sec0.textContent=`⚡ Animated Stickers (${ANIMATED_STICKERS.length}) — tap = add WITH animation (preview + export both animate)`;
    body.append(sec0);
    ANIMATED_STICKERS.forEach(st=>{
      const isText=!!st.bg;
      const b=document.createElement('button');
      b.className=(isText?'yt-sticker':'fx-emoji')+' anim-'+st.anim;
      b.textContent=st.t; b.title=`Add ${st.n||st.t} — ${st.anim} animation`;
      if(isText){ b.style.background=st.bg; b.style.color=st.color||'#fff'; }
      b.onclick=()=>{ addTextAtPlayhead(st.t,{size:st.size||80,x:30+(Math.random()*18),y:28+(Math.random()*18),len:4,anim:st.anim,color:st.color||'#ffffff',bg:st.bg||'transparent',font:'Arial',bold:st.bold??true}); };
      const lab=document.createElement('small'); lab.className='fx-anim-label'; lab.textContent=st.anim;
      const holder=document.createElement('span'); holder.style.display='inline-flex'; holder.style.flexDirection='column'; holder.style.alignItems='center';
      b.style.display='inline-block';
      holder.append(b,lab); body.append(holder);
    });
    const sec1=document.createElement('p'); sec1.className='fx-sec-title'; sec1.textContent=`⭐ All Static Stickers (${STICKERS.length}) — click = add, then pick any of ${TEXT_ANIMS.length-1} animations below / in Settings`;
    body.append(sec1);
    STICKERS.forEach(s=>{
      const b=document.createElement('button'); b.className='fx-emoji'; b.textContent=s; b.title='Add sticker '+s;
      b.onclick=()=>{ addTextAtPlayhead(s,{size:72,x:40,y:35,len:3,anim:(window._stickerAnim||'none')}); };
      body.append(b);
    });
    const animRow=document.createElement('div'); animRow.className='fx-size-row';
    animRow.innerHTML=`<span>🎞 New static stickers will use:</span>`;
    const animSel=document.createElement('select'); animSel.title='Animation for newly added static stickers';
    TEXT_ANIMS.forEach(a=>{const op=document.createElement('option');op.value=a.v;op.textContent='🎞 '+a.n;if((window._stickerAnim||'none')===a.v)op.selected=true;animSel.append(op);});
    animSel.onchange=()=>{ window._stickerAnim=animSel.value; };
    animRow.append(animSel); body.append(animRow);
    const sec2=document.createElement('p'); sec2.className='fx-sec-title'; sec2.textContent=`📺 YouTube Pack (${YT_STICKERS.length} buttons + ${YT_EMOJIS.length} emoji) — animated Subscribe / Like / Bell / Live`;
    body.append(sec2);
    YT_EMOJIS.forEach(s=>{
      const b=document.createElement('button'); b.className='fx-emoji'; b.textContent=s; b.title='Add YT emoji '+s;
      b.onclick=()=>{ addTextAtPlayhead(s,{size:76,x:38,y:32,len:3,anim:'pulse'}); };
      body.append(b);
    });
    YT_STICKERS.forEach(st=>{
      const b=document.createElement('button'); b.className='yt-sticker anim-'+(st.anim||'pulse'); b.textContent=st.t; b.title=`Add ${st.t} — ${st.anim||'pulse'}`;
      if(st.bg==='#222222'||st.bg==='#333333') b.classList.add('dark');
      else b.style.background=st.bg;
      b.style.color=st.color;
      b.onclick=()=>{ addTextAtPlayhead(st.t,{size:st.size,color:st.color,bg:st.bg,x:30,y:30,len:4,font:'Arial',bold:true,anim:st.anim||'pulse'}); };
      body.append(b);
    });
    body.append(fxSelectedSizeRow());
    const note=document.createElement('p'); note.className='fx-note'; note.textContent='Sticker = text overlay with animation. Animated ones play instantly on preview AND in export. Select any sticker, then change size / animation in the row above or Settings → Text Overlay. Drag on preview = move, corner ◢ = resize, ✏️ = edit.';
    body.append(note);
  }
  else if(mode==='emoji'){
    setFxActive($('btnEmojiBar')); title.textContent=`😀 Animated Emojis MAX (${EMOJIS.length}+${ANIMATED_STICKERS.length}) — pick animation, then tap emoji`;
    const topRow=document.createElement('div'); topRow.className='fx-size-row';
    topRow.innerHTML=`<span>🎞 New emojis will animate with:</span>`;
    const eAnim=document.createElement('select'); eAnim.title='Animation for newly added emojis';
    TEXT_ANIMS.forEach(a=>{const op=document.createElement('option');op.value=a.v;op.textContent='🎞 '+a.n;if((window._emojiAnim||'bounce')===a.v)op.selected=true;eAnim.append(op);});
    if(!window._emojiAnim) window._emojiAnim='bounce';
    eAnim.onchange=()=>{ window._emojiAnim=eAnim.value; };
    topRow.append(eAnim); body.append(topRow);
    const secA=document.createElement('p'); secA.className='fx-sec-title'; secA.textContent=`⚡ Quick Animated Emojis (${ANIMATED_STICKERS.length}) — tap = add with its animation`;
    body.append(secA);
    ANIMATED_STICKERS.forEach(st=>{
      const isText=!!st.bg;
      const b=document.createElement('button'); b.className=(isText?'yt-sticker':'fx-emoji')+' anim-'+st.anim; b.style.display='inline-block'; b.textContent=st.t; b.title=`Add ${st.n||st.t} — ${st.anim}`;
      if(isText){ b.style.background=st.bg; b.style.color=st.color||'#fff'; }
      b.onclick=()=>{ addTextAtPlayhead(st.t,{size:st.size||72,x:35+(Math.random()*20),y:30+(Math.random()*20),len:3,anim:st.anim,color:st.color||'#ffffff',bg:st.bg||'transparent',font:'Arial',bold:st.bold??true}); };
      body.append(b);
    });
    const secB=document.createElement('p'); secB.className='fx-sec-title'; secB.textContent=`😀 All Emojis (${EMOJIS.length}) — uses the animation picked above`;
    body.append(secB);
    EMOJIS.forEach(s=>{
      const b=document.createElement('button'); b.className='fx-emoji'; b.textContent=s; b.title='Add emoji '+s;
      b.onclick=()=>{ addTextAtPlayhead(s,{size:64,x:35+(Math.random()*20),y:30+(Math.random()*20),len:3,anim:(window._emojiAnim||'bounce')}); };
      body.append(b);
    });
    body.append(fxSelectedSizeRow());
    const note=document.createElement('p'); note.className='fx-note'; note.textContent='Emojis are animated text overlays — they loop on preview and are burned into the export with the same animation. Change animation anytime from the dropdown above or Settings.';
    body.append(note);
  }
  else if(mode==='trans'){
    setFxActive($('btnTransBar')); title.textContent=`🔀 Transitions (${TRANSITIONS.length}) — entry animation at the START of the selected clip`;
    const c=selClip();
    const noneB=document.createElement('button'); noneB.className='fx-chip'+((!c||c.transition==='none')?' active':'');
    noneB.textContent='None';
    noneB.onclick=()=>{ const cc=selClip(); if(!cc) return alert('Select a video clip first'); pushHistory(); cc.transition='none'; syncAll(); openFx('trans'); };
    body.append(noneB);
    [...new Set(TRANSITIONS.map(t=>t.cat))].forEach(cat=>{
      const sec=document.createElement('p'); sec.className='fx-sec-title'; sec.textContent=cat;
      body.append(sec);
      TRANSITIONS.filter(f=>f.cat===cat).forEach(f=>{
        const b=document.createElement('button'); b.className='fx-chip'+(c&&c.transition===f.v?' active':'');
        b.textContent=f.n;
        b.onclick=()=>{ const cc=selClip(); if(!cc) return alert('Select a video clip first'); pushHistory(); cc.transition=f.v; syncAll(); openFx('trans'); };
        body.append(b);
      });
    });
    const row=document.createElement('div'); row.className='fx-row';
    row.innerHTML=`<span>⏳ Duration (sec):</span>`;
    const inp=document.createElement('input'); inp.type='number'; inp.min='0.1'; inp.max='3'; inp.step='0.1'; inp.value=c?c.transDur??0.5:0.5;
    inp.onchange=()=>{ const cc=selClip(); if(!cc) return; pushHistory(); cc.transDur=Math.max(0.1,Math.min(3,+inp.value||0.5)); };
    row.append(inp);
    const hint=document.createElement('span'); hint.textContent='IN plays at the start of the selected clip. For animations between two clips, set OUT on the first clip + IN on the next, or use the 🔗 Between panel.';
    row.append(hint); body.append(row);
  }
  else if(mode==='between'){
    const jb=$('btnJointBar'); setFxActive(jb||$('btnTransBar')); title.textContent=`🔗 Between Clips (${TRANSITIONS.length} animations) — OUT of one clip into IN of the next`;
    if(clips.length<2){
      const p=document.createElement('p'); p.className='fx-note'; p.textContent='Add at least 2 video clips to create a between-clips animation. Then pick an animation below to apply to the joint.';
      body.append(p);
    } else {
      const jl=document.createElement('div'); jl.className='fx-row'; jl.innerHTML=`<span>Joint:</span>`;
      const jsel=document.createElement('select'); jsel.style.flex='1';
      for(let i=0;i<clips.length-1;i++){ const op=document.createElement('option'); op.value=i; op.textContent=`${i+1} → ${i+2}: ${clips[i].name.slice(0,12)} → ${clips[i+1].name.slice(0,12)}`; jsel.append(op); }
      const outIn=document.createElement('select'); outIn.title='Which side to set';
      [['both','OUT + IN (both sides)'],['out','OUT only (first clip)'],['in','IN only (next clip)']].forEach(([v,n])=>{ const op=document.createElement('option'); op.value=v; op.textContent=n; outIn.append(op); });
      jl.append(jsel,outIn); body.append(jl);
      const durRow=document.createElement('div'); durRow.className='fx-row'; durRow.innerHTML=`<span>⏳ Duration (sec):</span>`;
      const dinp=document.createElement('input'); dinp.type='number'; dinp.min='0.1'; dinp.max='3'; dinp.step='0.1'; dinp.value='0.5';
      durRow.append(dinp); body.append(durRow);
      const applyNote=document.createElement('p'); applyNote.className='fx-note'; applyNote.textContent='Pick a joint + side above, then click any animation below to apply it. OUT plays at the end of the first clip, IN at the start of the next — together they form the between-clips animation.';
      body.append(applyNote);
      const noneB=document.createElement('button'); noneB.className='fx-chip'; noneB.textContent='None (clear joint)';
      noneB.onclick=()=>{ const i=+jsel.value, side=outIn.value; pushHistory(); if(side==='out'||side==='both') ensureClipDefaults(clips[i]).outTransition='none'; if(side==='in'||side==='both') ensureClipDefaults(clips[i+1]).transition='none'; syncAll(); openFx('between'); };
      body.append(noneB);
      [...new Set(TRANSITIONS.map(t=>t.cat))].forEach(cat=>{
        const sec=document.createElement('p'); sec.className='fx-sec-title'; sec.textContent=cat;
        body.append(sec);
        TRANSITIONS.filter(f=>f.cat===cat).forEach(f=>{
          const b=document.createElement('button'); b.className='fx-chip'; b.textContent=f.n;
          b.onclick=()=>{ const i=+jsel.value, side=outIn.value, d=Math.max(0.1,Math.min(3,+dinp.value||0.5)); pushHistory(); if(side==='out'||side==='both'){ const a=ensureClipDefaults(clips[i]); a.outTransition=f.v; a.outTransDur=d; } if(side==='in'||side==='both'){ const nx=ensureClipDefaults(clips[i+1]); nx.transition=f.v; nx.transDur=d; } syncAll(); openFx('between'); const s=clipStartGlobal(clips[i])+Math.max(0,effDur(clips[i])-d); seek(s); };
          body.append(b);
        });
      });
      const allRow=document.createElement('div'); allRow.className='fx-row';
      allRow.innerHTML=`<span>Apply one animation to ALL joints:</span>`;
      const allSel=document.createElement('select');
      TRANSITIONS.forEach(t=>{ const op=document.createElement('option'); op.value=t.v; op.textContent=t.n; allSel.append(op); });
      const allBtn=document.createElement('button'); allBtn.textContent='Apply to All';
      allBtn.onclick=()=>{ const d=Math.max(0.1,Math.min(3,+dinp.value||0.5)); pushHistory(); clips.forEach((c,idx)=>{ ensureClipDefaults(c); if(idx<clips.length-1){ c.outTransition=allSel.value; c.outTransDur=d; } if(idx>0){ c.transition=allSel.value; c.transDur=d; } }); syncAll(); openFx('between'); };
      allRow.append(allSel,allBtn); body.append(allRow);
    }
  }
}
$('btnFilterBar').onclick=()=>{ $('fxDrawer').classList.contains('hidden')||fxMode!=='filter' ? openFx('filter') : closeFx(); };
$('btnEffectBar').onclick=()=>{ $('fxDrawer').classList.contains('hidden')||fxMode!=='effect' ? openFx('effect') : closeFx(); };
$('btnStickerBar').onclick=()=>{ $('fxDrawer').classList.contains('hidden')||fxMode!=='sticker' ? openFx('sticker') : closeFx(); };
$('btnEmojiBar').onclick=()=>{ $('fxDrawer').classList.contains('hidden')||fxMode!=='emoji' ? openFx('emoji') : closeFx(); };
$('btnTransBar').onclick=()=>{ $('fxDrawer').classList.contains('hidden')||fxMode!=='trans' ? openFx('trans') : closeFx(); };
if($('btnJointBar')) $('btnJointBar').onclick=()=>{ $('fxDrawer').classList.contains('hidden')||fxMode!=='between' ? openFx('between') : closeFx(); };
function closeFx(){ $('fxDrawer').classList.add('hidden'); setFxActive(null); fxMode=null; }
$('btnFxClose').onclick=closeFx;

/* ---------- export ---------- */
let exporting=false, exportCancel=false;
$('btnExport').onclick=()=>{
  if(!exporting){ $('expBar').style.width='0%'; $('expText').textContent='Ready to export.'; }
  $('exportModal').classList.remove('hidden');
};
/* Close hides the dialog AND stops a running export (no invisible background rendering) */
$('btnCloseExport').onclick=()=>{ if(exporting) exportCancel=true; $('exportModal').classList.add('hidden'); };
if($('btnCancelExport')) $('btnCancelExport').onclick=()=>{
  if(exporting){ exportCancel=true; $('expText').textContent='Cancelling…'; }
  else $('exportModal').classList.add('hidden');
};
$('btnStartExport').onclick=startExport;

function pickMime(want){
  const cands = want==='mp4'
    ? ['video/mp4;codecs="avc1.42E01E,mp4a.40.2"','video/mp4','video/webm;codecs=h264','video/webm;codecs=vp9','video/webm']
    : ['video/webm;codecs=vp9','video/webm'];
  for(const m of cands){ try{ if(MediaRecorder.isTypeSupported(m)) return m; }catch{} }
  return '';
}
async function startExport(){
  if(exporting) return; // never run two exports at once
  if(!clips.length) return alert('Import videos first');
  const erv=$('expRes').value;
  const [rw,rh]=(expResAuto||erv==='original')?[canvas.width,canvas.height]:erv.split('x').map(Number);
  const fps = +$('expFps').value, want = $('expFormat').value;
  const mime = pickMime(want);
  if(!mime) return alert('MediaRecorder not supported in this browser. Use Chrome/Edge.');
  const ext = mime.includes('mp4')?'mp4':'webm';
  exporting=true; exportCancel=false;
  const startBtn=$('btnStartExport');
  if(startBtn){ startBtn.disabled=true; startBtn.textContent='Exporting…'; }
  $('expBar').style.width='0%';
  $('expText').textContent='Exporting… please keep tab visible. 0%';
  pause();

  let expCanvas,ectx,stream,rec,chunks=[],done=null;
  let actx=null, dest=null, vSrc=null,mSrc=null,vGain=null,mGain=null;
  let expVideo=null, expMusic=null, expAudios=[];
  try{
    expCanvas=document.createElement('canvas'); expCanvas.width=rw; expCanvas.height=rh;
    ectx=expCanvas.getContext('2d');
    stream=expCanvas.captureStream(fps);
    try{
      actx=new (window.AudioContext||window.webkitAudioContext)();
      dest=actx.createMediaStreamDestination();
    }catch(e){}
    expVideo=document.createElement('video'); expVideo.muted=false; expVideo.crossOrigin='anonymous';
    expMusic=document.createElement('audio'); expMusic.loop=false;
    /* MULTI AUDIO export elements */
    if(actx&&dest){
      try{
        vSrc=actx.createMediaElementSource(expVideo); vGain=actx.createGain(); vSrc.connect(vGain).connect(dest); vGain.connect(actx.destination);
      }catch(e){}
      if(bgMusicName){ try{ expMusic.src=bgAudio.src; mSrc=actx.createMediaElementSource(expMusic); mGain=actx.createGain(); mSrc.connect(mGain).connect(dest);}catch(e){} }
      audioClips.forEach(a=>{
        try{
          const el=document.createElement('audio'); el.src=a.url; el.preload='auto'; el.crossOrigin='anonymous';
          const src=actx.createMediaElementSource(el); const g=actx.createGain(); src.connect(g).connect(dest);
          expAudios.push({a,el,gain:g});
        }catch(err){ console.warn('audio export skip',a.name,err); }
      });
      dest.stream.getAudioTracks().forEach(t=>stream.addTrack(t));
    }
    rec=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:8_000_000});
    rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
    done=new Promise(res=>rec.onstop=res);
    rec.start(500);
  }catch(e){
    console.error(e);
    $('expText').textContent='Export failed to start: '+e.message;
    exporting=false; exportCancel=false;
    if(startBtn){ startBtn.disabled=false; startBtn.textContent='Start Export'; }
    return;
  }

  const tot=totalDur(); let elapsed=0;
  let exportCancelled=false, exportFailed=false;
  try{
    for(let i=0;i<clips.length;i++){
      const c=ensureClipDefaults(clips[i]);
      const loaded = new Promise((res,rej)=>{ expVideo.onloadedmetadata=res; expVideo.onerror=rej; });
      expVideo.src=c.url; expVideo.playbackRate=c.speed; expVideo.volume=c.volume;
      await loaded;
      expVideo.currentTime=Math.max(0,c.trimStart+0.01);
      await expVideo.play().catch(()=>{});
      if(vGain) vGain.gain.value=c.volume;
      if(i===0&&bgMusicName){ expMusic.volume=$('musicVolume').value/100; expMusic.play().catch(()=>{}); }
      if(i===0){ const mv=$('musicVolume').value/100; expAudios.forEach(({a,el})=>{ el.volume=1; }); }
      /* Watchdog: a stalled video can never hang the export forever.
         No progress for 1s -> resume + nudge forward; absolute per-clip cap. */
      let lastCT=-1,lastAdvT=performance.now();
      const clipT0=performance.now();
      const maxWall=(effDur(c)/Math.max(0.25,c.speed))*1000+60000;
      const res=await new Promise(resolve=>{
        function frame(){
          if(exportCancel){ resolve('cancel'); return; }
          const nowMs=performance.now();
          const ct0=expVideo.currentTime;
          if(ct0>=c.trimEnd-0.05||expVideo.ended){ resolve('done'); return; }
          if(nowMs-clipT0>maxWall){ resolve('timeout'); return; }
          if(Math.abs(ct0-lastCT)<1e-4){
            if(nowMs-lastAdvT>1000){
              lastAdvT=nowMs;
              if(ct0<c.trimEnd-0.06){
                try{ if(expVideo.paused&&!expVideo.ended) expVideo.play().catch(()=>{}); }catch{}
                try{ expVideo.currentTime=Math.min(c.trimEnd-0.06,ct0+0.5); }catch{}
              }else{ resolve('done'); return; }
            }
          }else{ lastCT=ct0; lastAdvT=nowMs; }
          const off=(expVideo.currentTime-c.trimStart)/c.speed;
          drawClipFrame(ectx,expVideo,c,rw,rh,Math.max(0,off));
          const saveT=globalTime; globalTime=elapsed+Math.max(0,off);
          /* sync multi-audio in export */
          const mv=$('musicVolume').value/100;
          expAudios.forEach(({a,el,gain})=>{
            try{
              if(gain) gain.gain.value=a.volume*mv;
              const inside=globalTime>=a.start&&globalTime<=a.end;
              if(inside && el.paused){ el.currentTime=Math.min(Math.max(0,globalTime-a.start),Math.max(0,a.duration-0.1)); el.play().catch(()=>{}); }
              else if(!inside && !el.paused){ el.pause(); }
            }catch{}
          });
          imageOverlays.forEach(o=>{
            if(globalTime>=o.start&&globalTime<=o.end&&o.img&&o.img.complete){
              ensureImageDefaults(o);
              const localT=globalTime-o.start, dur=Math.max(0.1,o.end-o.start);
              let alpha=o.opacity, sc=1, dx=0, dy=0, rot=0;
              const p=Math.min(1,localT/0.5);
              if(o.anim==='fade') alpha*=p;
              else if(o.anim==='zoom'){ sc=0.4+0.6*p; alpha*=p; }
              else if(o.anim==='zoomOut'){ sc=1.6-0.6*p; alpha*=p; }
              else if(o.anim==='zoomBounce'){ sc=Math.max(0.2,0.3+0.7*easeOutBack(p)); alpha*=p; }
              else if(o.anim==='slideL'){ dx=-80*(1-p); alpha*=p; }
              else if(o.anim==='slideR'){ dx=80*(1-p); alpha*=p; }
              else if(o.anim==='slideLoop'){ dx=Math.sin(localT*3)*12; }
              else if(o.anim==='up'||o.anim==='riseFade'){ dy=60*(1-p); alpha*=p; }
              else if(o.anim==='drop'){ dy=-60*(1-p); alpha*=p; }
              else if(o.anim==='flip'||o.anim==='spinIn'){ sc=0.4+0.6*p; alpha*=p; rot=(1-p)*2; }
              else if(o.anim==='blurIn'){ alpha*=p; sc=0.9+0.1*p; }
              else if(o.anim==='pulse'||o.anim==='popLoop'){ sc=1+0.08*Math.sin(localT*6); }
              else if(o.anim==='bounce'){ dy=-Math.abs(Math.sin(localT*4))*20; }
              else if(o.anim==='spin'){ rot=localT*2.2; }
              else if(o.anim==='wave'){ rot=Math.sin(localT*5)*0.12; sc=1+0.05*Math.sin(localT*5); }
              else if(o.anim==='heartbeat'){ sc=1+0.12*Math.sin(localT*6); }
              else if(o.anim==='float'){ dy=-Math.abs(Math.sin(localT*2))*14; }
              else if(o.anim==='shake'){ dx=Math.sin(localT*14)*10; }
              else if(o.anim==='swing'){ rot=Math.sin(localT*3)*0.15; }
              else if(o.anim==='jello'){ sc=1+0.07*Math.sin(localT*8); rot=Math.sin(localT*8)*0.05; }
              else if(o.anim==='tada'){ sc=1+0.12*Math.sin(localT*8); rot=Math.sin(localT*8)*0.14; }
              else if(o.anim==='rubber'){ sc=1+0.14*Math.sin(localT*6); rot=Math.sin(localT*6)*0.04; }
              else if(o.anim==='wobble'){ dx=Math.sin(localT*6)*10; rot=Math.sin(localT*6)*0.12; }
              else if(o.anim==='flipLoop'){ sc=Math.abs(Math.cos(localT*3))*0.9+0.1; }
              else if(o.anim==='spinFast'){ rot=localT*6; }
              else if(o.anim==='bounceBig'){ dy=-Math.abs(Math.sin(localT*4))*30; sc=1+0.04*Math.sin(localT*8); }
              else if(o.anim==='slideUD'){ dy=Math.sin(localT*3)*14; }
              else if(o.anim==='zoomPulse'){ sc=1+0.18*Math.sin(localT*5); }
              else if(o.anim==='tilt'){ rot=Math.sin(localT*3)*0.22; sc=1+0.05*Math.sin(localT*3); }
              else if(o.anim==='popSpin'){ sc=1+0.12*Math.sin(localT*6); rot=localT*2; }
              else if(o.anim==='storm'){ dx=Math.sin(localT*20)*12; dy=Math.cos(localT*17)*8; rot=Math.sin(localT*20)*0.1; }
              else if(o.anim==='flicker'){ alpha*=(Math.sin(localT*18)>-0.2?1:0.35); }
              else if(o.anim==='blink'){ alpha*=0.55+0.45*Math.abs(Math.sin(localT*3)); }
              else if(o.anim==='roll'){ dx=Math.sin(localT*2.5)*20; rot=localT*2.5; }
              else if(o.anim==='jump'){ dy=-Math.abs(Math.sin(localT*3.5))*26; sc=1+0.05*Math.sin(localT*7); }
              else if(o.anim==='neon'){ sc=1+0.05*Math.sin(localT*5); alpha*=0.88+0.12*Math.sin(localT*5); }
              else if(o.anim==='glow'){ sc=1+0.04*Math.sin(localT*5); }
              ectx.save(); ectx.globalAlpha=Math.max(0,Math.min(1,alpha));
              const w=rw*o.w/100*sc,h=w*(o.img.height/o.img.width);
              if(rot){ const cx=rw*o.x/100+dx+w/2, cy=rh*o.y/100+dy+h/2; ectx.translate(cx,cy); ectx.rotate(rot); ectx.drawImage(o.img,-w/2,-h/2,w,h); }
              else ectx.drawImage(o.img,rw*o.x/100+dx,rh*o.y/100+dy,w,h);
              ectx.restore();
            }
          });
          textOverlays.forEach(o=>{
            if(globalTime>=o.start&&globalTime<=o.end){
              ensureTextDefaults(o);
              const localT=globalTime-o.start, dur=Math.max(0.1,o.end-o.start);
              let alpha=1, dx=0, dy=0, sc=1, rot=0;
              const p=Math.min(1,localT/0.5);
              if(o.anim==='fade') alpha=p;
              else if(o.anim==='slideL'){ dx=-60*(1-p); alpha=p; }
              else if(o.anim==='slideR'){ dx=60*(1-p); alpha=p; }
              else if(o.anim==='slideLoop'){ dx=Math.sin(localT*3)*14; }
              else if(o.anim==='up'||o.anim==='riseFade'){ dy=50*(1-p); alpha=p; if(o.anim==='riseFade') sc=0.92+0.08*p; }
              else if(o.anim==='drop'){ dy=-50*(1-p); alpha=p; }
              else if(o.anim==='zoom'){ sc=0.4+0.6*p; alpha=p; }
              else if(o.anim==='zoomOut'){ sc=1.8-0.8*p; alpha=p; }
              else if(o.anim==='zoomBounce'){ sc=Math.max(0.2,0.3+0.7*easeOutBack(p)); alpha=p; }
              else if(o.anim==='flip'){ sc=Math.abs(Math.cos(p*Math.PI/2))*0.9+0.1; alpha=p; }
              else if(o.anim==='spinIn'){ rot=(1-p)*Math.PI*2; sc=0.4+0.6*p; alpha=p; }
              else if(o.anim==='blurIn'){ alpha=p; sc=0.92+0.08*p; }
              else if(o.anim==='bounce'){ dy=-Math.abs(Math.sin(localT*4))*24; }
              else if(o.anim==='pulse'||o.anim==='popLoop'){ sc=1+0.1*Math.sin(localT*6); }
              else if(o.anim==='spin'){ rot=localT*2.2; }
              else if(o.anim==='wave'){ rot=Math.sin(localT*5)*0.12; sc=1+0.05*Math.sin(localT*5); }
              else if(o.anim==='heartbeat'){ sc=1+0.14*Math.sin(localT*6)+0.05*Math.sin(localT*12); }
              else if(o.anim==='float'){ dy=-Math.abs(Math.sin(localT*2))*16; }
              else if(o.anim==='shake'){ dx=Math.sin(localT*14)*12; }
              else if(o.anim==='glow'){ sc=1+0.04*Math.sin(localT*5); }
              else if(o.anim==='swing'){ rot=Math.sin(localT*3)*0.16; }
              else if(o.anim==='jello'){ sc=1+0.08*Math.sin(localT*8); rot=Math.sin(localT*8)*0.06; }
              else if(o.anim==='tada'){ sc=1+0.13*Math.sin(localT*8); rot=Math.sin(localT*8)*0.15; }
              else if(o.anim==='rubber'){ sc=1+0.15*Math.sin(localT*6); rot=Math.sin(localT*6)*0.05; }
              else if(o.anim==='wobble'){ dx=Math.sin(localT*6)*12; rot=Math.sin(localT*6)*0.13; }
              else if(o.anim==='flipLoop'){ sc=Math.abs(Math.cos(localT*3))*0.9+0.1; }
              else if(o.anim==='spinFast'){ rot=localT*6; }
              else if(o.anim==='bounceBig'){ dy=-Math.abs(Math.sin(localT*4))*34; sc=1+0.05*Math.sin(localT*8); }
              else if(o.anim==='slideUD'){ dy=Math.sin(localT*3)*16; }
              else if(o.anim==='zoomPulse'){ sc=1+0.2*Math.sin(localT*5); }
              else if(o.anim==='tilt'){ rot=Math.sin(localT*3)*0.24; sc=1+0.06*Math.sin(localT*3); }
              else if(o.anim==='popSpin'){ sc=1+0.13*Math.sin(localT*6); rot=localT*2; }
              else if(o.anim==='storm'){ dx=Math.sin(localT*20)*14; dy=Math.cos(localT*17)*9; rot=Math.sin(localT*20)*0.11; }
              else if(o.anim==='flicker'){ alpha*=(Math.sin(localT*18)>-0.2?1:0.35); }
              else if(o.anim==='blink'){ alpha*=0.55+0.45*Math.abs(Math.sin(localT*3)); }
              else if(o.anim==='roll'){ dx=Math.sin(localT*2.5)*22; rot=localT*2.5; }
              else if(o.anim==='jump'){ dy=-Math.abs(Math.sin(localT*3.5))*28; sc=1+0.06*Math.sin(localT*7); }
              else if(o.anim==='neon'){ sc=1+0.06*Math.sin(localT*5); }
              ectx.save();
              ectx.globalAlpha=Math.max(0,Math.min(1,alpha));
              const fs=o.size*rw/1280*sc;
              ectx.font=`${o.italic?'italic ':''}${o.bold?'bold ':''}${fs}px ${o.font||'Arial'}, sans-serif`;
              if(o.anim==='neon'){ ectx.shadowColor='#0ff'; ectx.shadowBlur=22; }
              else if(o.anim==='glow'){ ectx.shadowColor='#ffe36e'; ectx.shadowBlur=18; }
              else { ectx.shadowColor='#000'; ectx.shadowBlur=6; }
              const tx=rw*o.x/100+dx, ty=rh*o.y/100+dy;
              const tw=ectx.measureText(o.text).width;
              if(o.bg && o.bg!=='transparent'){ ectx.fillStyle=o.bg; ectx.fillRect(tx-6,ty-fs-6,tw+12,fs+16); }
              if(rot) { ectx.translate(tx+tw/2,ty-fs/3); ectx.rotate(rot); ectx.translate(-(tx+tw/2),-(ty-fs/3)); }
              ectx.fillStyle=o.color;
              ectx.fillText(o.text,tx,ty);
              ectx.restore();
            }
          });
          globalTime=saveT;
          requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
      });
      if(res==='cancel'){ try{expVideo.pause();}catch(e){} exportCancelled=true; break; }
      elapsed+=effDur(c);
      const pct=Math.round(elapsed/tot*100);
      $('expBar').style.width=pct+'%'; $('expText').textContent=`Exporting… ${pct}% (clip ${i+1}/${clips.length})`;
      expVideo.pause();
    }
  }catch(err){ console.error(err); exportFailed=true; $('expText').textContent='Export failed: '+err.message; try{rec.stop();}catch(e){} }
  try{rec.stop();}catch(e){}
  try{await done;}catch(e){}
  /* Full cleanup so nothing keeps rendering/playing after export ends */
  try{expMusic.pause();}catch(e){}
  expAudios.forEach(({el})=>{try{el.pause();}catch(e){}});
  try{expVideo.pause();expVideo.removeAttribute('src');expVideo.load();}catch(e){}
  try{expMusic.removeAttribute('src');}catch(e){}
  try{actx&&await actx.close();}catch(e){}
  try{stream.getTracks().forEach(t=>t.stop());}catch(e){}
  if(exportCancelled||exportCancel){
    $('expBar').style.width='0%';
    $('expText').textContent='Export cancelled.';
    if(!$('exportModal').classList.contains('hidden')) setTimeout(()=>$('exportModal').classList.add('hidden'),1200);
  }else if(!exportFailed){
    const blob=new Blob(chunks,{type:mime.split(';')[0]});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`edited-video-${rw}x${rh}-${fps}fps.${ext}`; a.click();
    setTimeout(()=>{try{URL.revokeObjectURL(a.href);}catch(e){}},10000);
    $('expBar').style.width='100%'; $('expText').textContent=`Done! Downloaded .${ext} (${(blob.size/1048576).toFixed(1)} MB)`;
    setTimeout(()=>$('exportModal').classList.add('hidden'),2500);
  }
  exporting=false; exportCancel=false;
  if(startBtn){ startBtn.disabled=false; startBtn.textContent='Start Export'; }
  pause(); seek(globalTime); // re-sync preview video + UI so playback is clean after export
}

/* init — single preview locked */
clips.forEach(ensureClipDefaults);
textOverlays.forEach(ensureTextDefaults);
imageOverlays.forEach(ensureImageDefaults);
{ const zv=$('zoomVal'); if(zv) zv.textContent=pxPerSec+'px/s'; }
applyPreviewLayout();
applyLayout();
syncAll();
requestAnimationFrame(loop);

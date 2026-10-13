const express = require('express');

const app = express();
const port = Number(process.env.PORT) || 3000;
const payments = new Map();

app.disable('x-powered-by');
app.use(express.json({ limit: '10kb' }));

function parsePaymentId(value) {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}

function parseAmount(value) {
  if (typeof value !== 'string' || !/^\d+(?:\.\d{1,2})?$/.test(value)) return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function getOrCreatePayment(id, amount) {
  const payment = { id, amount, status: 'pending', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  payments.set(id, payment);
  return { payment };
}

function paymentStatus(payment) {
  return { paymentId: payment.id, amount: payment.amount, status: payment.status, updatedAt: payment.updatedAt };
}

function paymentPage(payment) {
  const safePayment = JSON.stringify(paymentStatus(payment)).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#101b32"><title>Complete payment · SimPay</title>
<style>
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:radial-gradient(ellipse at 20% 15%,#203a68 0,transparent 38%),#101b32;color:#17233b;font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}.card{width:min(100%,440px);overflow:hidden;border-radius:24px;background:#fff;box-shadow:0 28px 80px #050b193d}.top{padding:28px 32px 24px;border-bottom:1px solid #edf0f5}.brand{display:flex;align-items:center;gap:10px;color:#17233b;font-weight:750;letter-spacing:-.03em}.mark{width:32px;height:32px;display:grid;place-items:center;border-radius:10px;background:#e9f0ff;color:#315fd4;font-size:18px}.secure{margin-left:auto;color:#8490a5;font-size:12px;font-weight:550}.content{padding:30px 32px 32px}.eyebrow{margin:0 0 8px;color:#758198;font-size:12px;font-weight:700;letter-spacing:.11em;text-transform:uppercase}h1{margin:0;color:#17233b;font-size:25px;letter-spacing:-.04em}.sub{margin:8px 0 24px;color:#738097;font-size:14px;line-height:1.5}.amount{display:flex;align-items:baseline;justify-content:space-between;padding:18px 0;border-top:1px solid #edf0f5;border-bottom:1px solid #edf0f5}.amount-label{color:#758198;font-size:14px}.amount-value{font-size:29px;font-weight:760;letter-spacing:-.04em}.meta{display:flex;justify-content:space-between;padding:17px 0 22px;color:#758198;font-size:13px}.meta strong{color:#35415a;font-weight:650}.actions{display:grid;gap:10px}.button{height:50px;border:0;border-radius:12px;font:inherit;font-size:14px;font-weight:700;cursor:pointer;transition:transform .15s,background .15s}.button:active{transform:scale(.99)}.button:disabled{opacity:.58;cursor:wait}.pay{background:#315fd4;color:#fff}.pay:hover:not(:disabled){background:#264fbd}.decline{border:1px solid #e3e7ee;background:#fff;color:#546078}.decline:hover:not(:disabled){background:#f7f8fa}.notice{display:none;margin:16px 0 0;padding:12px 14px;border-radius:10px;font-size:13px;line-height:1.45}.notice.show{display:block}.notice.success{background:#ecf8f0;color:#187244}.notice.error{background:#fff1f0;color:#aa3c32}.foot{padding:15px 32px;background:#f8f9fb;color:#8993a5;text-align:center;font-size:11px}.foot span{color:#52617a;font-weight:650}@media(max-width:480px){.content{padding:26px 24px}.top,.foot{padding-left:24px;padding-right:24px}}
</style></head><body><main class="card"><header class="top"><div class="brand"><span class="mark">✦</span> SimPay <span class="secure">◈ &nbsp;Secure checkout</span></div></header>
<section class="content"><p class="eyebrow">Payment request</p><h1>Review and pay</h1><p class="sub">Confirm the details below to complete this simulated payment.</p>
<div class="amount"><span class="amount-label">Amount due</span><strong class="amount-value" id="amount"></strong></div>
<div class="meta"><span>Payment reference</span><strong id="payment-id"></strong></div>
<div class="actions"><button class="button pay" id="pay">Confirm payment</button><button class="button decline" id="decline">Decline payment</button></div>
<div class="notice" id="notice" role="status" aria-live="polite"></div></section><footer class="foot">Demo payment simulator &nbsp;·&nbsp; <span>No real money is moved</span></footer></main>
<script>
const payment=${safePayment};
const amount='₹ '+new Intl.NumberFormat('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2}).format(payment.amount);
document.getElementById('amount').textContent=amount;
document.getElementById('payment-id').textContent='#'+payment.paymentId;
const buttons=[document.getElementById('pay'),document.getElementById('decline')];
const notice=document.getElementById('notice');
function showStatus(status){buttons.forEach(button=>button.disabled=true);notice.className='notice show '+(status==='paid'?'success':'error');notice.textContent=status==='paid'?'Payment confirmed. You can return to the merchant.':'Payment declined. You can return to the merchant.';}
if(payment.status!=='pending') showStatus(payment.status);
async function decide(decision){if(payment.status!=='pending')return;buttons.forEach(button=>button.disabled=true);notice.className='notice show';notice.textContent='Processing…';try{const response=await fetch('/api/payments/'+payment.paymentId+'/decision',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({decision})});const data=await response.json();if(!response.ok)throw new Error(data.error||'Could not update payment');payment.status=data.status;showStatus(data.status);}catch(error){buttons.forEach(button=>button.disabled=false);notice.className='notice show error';notice.textContent=error.message;}}
document.getElementById('pay').addEventListener('click',()=>decide('paid'));
document.getElementById('decline').addEventListener('click',()=>decide('declined'));
</script></body></html>`;
}

app.get('/', (_req, res) => {
  res.type('html').send(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SimPay Gateway</title><body style="font:16px system-ui;max-width:680px;margin:12vh auto;padding:24px;color:#17233b"><h1>SimPay Gateway Simulator</h1><p>Create a payment link with an integer payment ID and amount.</p><pre>GET /pay?paymentId=123&amp;amount=19.99
GET /api/payments/123/status</pre></body></html>`);
});

app.get('/pay', (req, res) => {
  const id = parsePaymentId(req.query.paymentId);
  const amount = parseAmount(req.query.amount);
  if (id === null || amount === null) {
    return res.status(400).type('text').send('Provide a non-negative integer paymentId and a positive amount with up to 2 decimal places.');
  }
  const result = getOrCreatePayment(id, amount);
  res.set('Cache-Control', 'no-store').type('html').send(paymentPage(result.payment));
});

app.get('/api/payments/:paymentId/status', (req, res) => {
  const id = parsePaymentId(req.params.paymentId);
  if (id === null) return res.status(400).json({ error: 'paymentId must be a non-negative safe integer.' });
  const payment = payments.get(id);
  if (!payment) return res.status(404).json({ paymentId: id, status: 'not_found', error: 'Payment has not been created.' });
  res.set('Cache-Control', 'no-store').json(paymentStatus(payment));
});

app.post('/api/payments/:paymentId/decision', (req, res) => {
  const id = parsePaymentId(req.params.paymentId);
  if (id === null) return res.status(400).json({ error: 'paymentId must be a non-negative safe integer.' });
  const payment = payments.get(id);
  if (!payment) return res.status(404).json({ error: 'Payment has not been created.' });
  const decision = req.body?.decision;
  if (!['paid', 'declined'].includes(decision)) return res.status(400).json({ error: 'decision must be "paid" or "declined".' });
  if (payment.status === 'pending') {
    payment.status = decision;
    payment.updatedAt = new Date().toISOString();
  } else if (payment.status !== decision) {
    return res.status(409).json({ error: 'Payment already has a final status.', ...paymentStatus(payment) });
  }
  res.set('Cache-Control', 'no-store').json(paymentStatus(payment));
});

app.listen(port, () => console.log(`SimPay listening on http://localhost:${port}`));


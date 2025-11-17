const $form = document.querySelector('form');

$form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const response = await fetch(process.env.SUBMISSION_API, {
    method: 'POST',
    body: new FormData($form),
  })

  if (response.ok) {
    const $reply = $form.querySelector('div')
    $reply.innerHTML = await response.text();
    $form.reset();
  }
});

$form.addEventListener('focus', event => {
  const $reply = $form.querySelector('div')
  $reply.innerHTML = '';
});
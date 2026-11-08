/** Link "clique para conversar": abre o WhatsApp no celular com o número e o texto prontos. */
export function whatsappLink(phone: string, text: string): string {
  return `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;
}

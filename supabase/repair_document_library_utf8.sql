-- Répare le double encodage Windows-1252/UTF-8 des modèles historiques.
-- La substitution temporaire protège le caractère de case à cocher (octet 0x90).
begin;

update public.internal_document_library
set
  title = case
    when title ~ '(Ã|â|Â)' then convert_from(convert_to(title, 'WIN1252'), 'UTF8')
    else title
  end,
  description = case
    when description ~ '(Ã|â|Â)' then convert_from(convert_to(description, 'WIN1252'), 'UTF8')
    else description
  end,
  content = case
    when content ~ '(Ã|â|Â)' then replace(
      convert_from(
        convert_to(replace(content, 'â˜' || chr(144), '[[CHECKBOX]]'), 'WIN1252'),
        'UTF8'
      ),
      '[[CHECKBOX]]',
      '☐'
    )
    else content
  end,
  updated_at = now()
where title ~ '(Ã|â|Â)'
   or description ~ '(Ã|â|Â)'
   or content ~ '(Ã|â|Â)';

commit;

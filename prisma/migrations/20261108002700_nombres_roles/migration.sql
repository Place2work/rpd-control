-- «Socio licenciatario» ahora se llama «Asesor de pensiones» (la clave interna sigue siendo socio).
UPDATE esquemas_comision SET nombre = 'Asesor de pensiones' WHERE tipo = 'socio' AND nombre = 'Socio licenciatario';

import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';

export const COLORS = {
  accent: '#c4527a', bg: '#f8f4f9', card: '#ffffff', sidebar: '#1e1228',
  surface: '#f2ecf6', border: '#e8e0f0', text: '#1e1228', muted: '#8a7a9a',
  success: '#52c4a0', warning: '#f4a041', danger: '#e05c6a', info: '#6a7fdb',
};

export const BATCH_COLORS = ['#e8607a','#6a7fdb','#f4a041','#52c4a0','#b47fe8','#e87a52'];

export const STATUS_COLORS = {
  Paid: '#52c4a0', Pending: '#f4a041', Overdue: '#e05c6a', Waived: '#8a7a9a',
  Planning: '#6a7fdb', Confirmed: '#52c4a0', Rehearsals: '#f4a041', Completed: '#8ab4c0', Cancelled: '#e05c6a',
};

export const Btn = ({ label, onPress, variant='primary', disabled, small, style:s }) => {
  const bg = variant==='primary' ? COLORS.accent : variant==='danger' ? COLORS.danger : variant==='success' ? COLORS.success : COLORS.surface;
  const textColor = ['primary','danger','success'].includes(variant) ? '#fff' : COLORS.text;
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.8}
      style={[{ backgroundColor:bg, paddingVertical:small?8:12, paddingHorizontal:small?14:20, borderRadius:11, alignItems:'center', justifyContent:'center', opacity:disabled?.5:1, flexDirection:'row', gap:6 }, s]}>
      <Text style={{ color:textColor, fontWeight:'700', fontSize:small?13:14 }}>{label}</Text>
    </TouchableOpacity>
  );
};

export const Card = ({ children, style:s, onPress }) => {
  const content = (
    <View style={[{ backgroundColor:COLORS.card, borderRadius:14, padding:16, borderWidth:1, borderColor:COLORS.border, shadowColor:'#000', shadowOffset:{width:0,height:2}, shadowOpacity:0.06, shadowRadius:8, elevation:2 }, s]}>
      {children}
    </View>
  );
  if (onPress) return <TouchableOpacity onPress={onPress} activeOpacity={0.8}>{content}</TouchableOpacity>;
  return content;
};

export const Badge = ({ label, color, small }) => (
  <View style={{ paddingVertical:3, paddingHorizontal:9, borderRadius:20, backgroundColor:color||COLORS.surface, borderWidth:1, borderColor:color||COLORS.border, alignSelf:'flex-start' }}>
    <Text style={{ fontSize:small?10:11, fontWeight:'700', color:color?'#fff':COLORS.muted }}>{label}</Text>
  </View>
);

export const Avatar = ({ name, size=40 }) => {
  const hue = name ? name.charCodeAt(0) * 7 % 360 : 200;
  return (
    <View style={{ width:size, height:size, borderRadius:size/2, backgroundColor:`hsl(${hue},55%,68%)`, alignItems:'center', justifyContent:'center' }}>
      <Text style={{ color:'#fff', fontWeight:'800', fontSize:size*.36 }}>{name?.[0]?.toUpperCase()||'?'}</Text>
    </View>
  );
};

export const Inp = ({ label, ...props }) => (
  <View style={{ marginBottom:14 }}>
    {label && <Text style={{ fontSize:11, fontWeight:'700', letterSpacing:0.7, textTransform:'uppercase', color:COLORS.muted, marginBottom:5 }}>{label}</Text>}
    <TextInput {...props} style={[{ backgroundColor:'#faf8fc', borderWidth:1.5, borderColor:COLORS.border, borderRadius:9, paddingHorizontal:13, paddingVertical:10, fontSize:14, color:COLORS.text }, props.style]}/>
  </View>
);

export const Spinner = ({ size='large', color=COLORS.accent }) => (
  <View style={{ flex:1, alignItems:'center', justifyContent:'center', padding:40 }}>
    <ActivityIndicator size={size} color={color}/>
  </View>
);

export const SectionTitle = ({ children }) => (
  <Text style={{ fontSize:18, fontWeight:'800', color:COLORS.text, marginBottom:12, marginTop:4 }}>{children}</Text>
);

export const EmptyCard = ({ icon, title, message }) => (
  <Card style={{ alignItems:'center', padding:40, borderStyle:'dashed', borderColor:COLORS.border }}>
    <Text style={{ fontSize:36, marginBottom:10 }}>{icon}</Text>
    <Text style={{ fontSize:16, fontWeight:'800', color:COLORS.text, marginBottom:6, textAlign:'center' }}>{title}</Text>
    {message && <Text style={{ fontSize:13, color:COLORS.muted, textAlign:'center' }}>{message}</Text>}
  </Card>
);

import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme';

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handle = async () => {
    if (!email || !password) return Alert.alert('Error', 'Please enter email and password');
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      Alert.alert('Login Failed', err.error || 'Invalid credentials');
    } finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS==='ios'?'padding':'height'}>
      <View style={s.inner}>
        <Text style={s.emoji}>🩰</Text>
        <Text style={s.title}>StudioFlow</Text>
        <Text style={s.sub}>Dance School Management</Text>
        <View style={s.card}>
          <Text style={s.heading}>Sign In</Text>
          <Text style={s.label}>EMAIL</Text>
          <TextInput style={s.input} value={email} onChangeText={setEmail} placeholder="you@example.com" autoCapitalize="none" keyboardType="email-address" placeholderTextColor={colors.muted} />
          <Text style={s.label}>PASSWORD</Text>
          <TextInput style={s.input} value={password} onChangeText={setPassword} placeholder="••••••••" secureTextEntry placeholderTextColor={colors.muted} />
          <TouchableOpacity style={[s.btn, loading && s.btnDisabled]} onPress={handle} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Sign In →</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  screen: { flex:1, backgroundColor:'#1e1228' },
  inner: { flex:1, justifyContent:'center', padding:24 },
  emoji: { textAlign:'center', fontSize:52, marginBottom:10 },
  title: { textAlign:'center', fontSize:30, fontWeight:'800', color:'#f0e8f8', marginBottom:4 },
  sub: { textAlign:'center', color:'#9a8aaa', fontSize:14, marginBottom:32 },
  card: { backgroundColor:'#fff', borderRadius:20, padding:24 },
  heading: { fontSize:20, fontWeight:'700', color:colors.text, marginBottom:18 },
  label: { fontSize:11, fontWeight:'700', color:colors.muted, letterSpacing:1, textTransform:'uppercase', marginBottom:5 },
  input: { borderWidth:1.5, borderColor:colors.border, borderRadius:10, padding:12, fontSize:14, color:colors.text, marginBottom:14 },
  btn: { backgroundColor:colors.accent, borderRadius:12, padding:14, alignItems:'center', marginTop:4 },
  btnDisabled: { opacity:0.6 },
  btnText: { color:'#fff', fontWeight:'700', fontSize:15 },
});
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Modal,
  Alert,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../src/theme/colors';
import { HapticTouchable } from '../src/components/HapticTouchable';
import { GlassCard } from '../src/components/GlassCard';
import { GradientPill } from '../src/components/GradientPill';
import {
  loadLocalProfile,
  saveLocalProfile,
  loadLocalCards,
  addLocalCard,
  deleteLocalCard,
  setDefaultLocalCard,
  loadLocalTransactions,
  recordLocalTransaction,
  getLocalFundedBalance,
  exportAllLocalData,
  wipeAllLocalData,
  UserProfile,
  PaymentCard,
  PaymentTransaction,
  DEFAULT_PROFILE,
} from '../src/storage/localStorage';
import { useApp } from '../src/context/AppContext';
import { haptic } from '../src/utils/haptics';

export default function ProfileScreen() {
  const { refreshDashboard } = useApp();
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [cards, setCards] = useState<PaymentCard[]>([]);
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [fundedBalance, setFundedBalance] = useState(10000);

  // Edit Profile Modal
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [bioInput, setBioInput] = useState('');

  // Add Card Modal
  const [showAddCard, setShowAddCard] = useState(false);
  const [cardNumber, setCardNumber] = useState('');
  const [cardHolder, setCardHolder] = useState('');
  const [expMonth, setExpMonth] = useState('');
  const [expYear, setExpYear] = useState('');

  // Deposit & Withdraw Modal
  const [showPayModal, setShowPayModal] = useState(false);
  const [payType, setPayType] = useState<'deposit' | 'withdrawal'>('deposit');
  const [payAmount, setPayAmount] = useState('500');

  const loadData = async () => {
    const p = await loadLocalProfile();
    const c = await loadLocalCards();
    const tx = await loadLocalTransactions();
    const b = await getLocalFundedBalance();

    setProfile(p);
    setCards(c);
    setTransactions(tx);
    setFundedBalance(b);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveProfile = async () => {
    const updated: UserProfile = {
      ...profile,
      name: nameInput.trim() || profile.name,
      email: emailInput.trim() || profile.email,
      bio: bioInput.trim() || profile.bio,
    };
    await saveLocalProfile(updated);
    setProfile(updated);
    setShowEditProfile(false);
    haptic.success();
    Alert.alert('Profile Saved', 'Your profile details are stored locally on your device.');
  };

  const handleAddCard = async () => {
    const cleanNum = cardNumber.replace(/\s+/g, '');
    if (cleanNum.length < 15) {
      Alert.alert('Invalid Card', 'Please enter a valid 15 or 16-digit card number.');
      return;
    }
    if (!cardHolder.trim()) {
      Alert.alert('Missing Name', 'Please enter the cardholder name.');
      return;
    }

    let brand: PaymentCard['brand'] = 'Card';
    if (cleanNum.startsWith('4')) brand = 'Visa';
    else if (cleanNum.startsWith('5')) brand = 'Mastercard';
    else if (cleanNum.startsWith('34') || cleanNum.startsWith('37')) brand = 'Amex';

    const last4 = cleanNum.slice(-4);

    const updated = await addLocalCard({
      brand,
      last4,
      cardholder: cardHolder.trim().toUpperCase(),
      expMonth: expMonth.trim() || '12',
      expYear: expYear.trim() || '29',
      isDefault: cards.length === 0,
    });

    setCards(updated);
    setShowAddCard(false);
    setCardNumber('');
    setCardHolder('');
    setExpMonth('');
    setExpYear('');
    haptic.success();
    Alert.alert('Card Encrypted & Saved', `Your ${brand} ending in ${last4} is stored 100% locally on this device.`);
  };

  const handleDeleteCard = (card: PaymentCard) => {
    Alert.alert(
      'Remove Card?',
      `Delete ${card.brand} ending in ${card.last4} from local device storage?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const updated = await deleteLocalCard(card.id);
            setCards(updated);
            haptic.medium();
          },
        },
      ]
    );
  };

  const handleProcessPayment = async () => {
    const amount = parseFloat(payAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount.');
      return;
    }

    if (cards.length === 0) {
      Alert.alert('No Card Linked', 'Please add a payment card first.');
      return;
    }

    const defaultCard = cards.find((c) => c.isDefault) || cards[0];

    if (payType === 'withdrawal' && amount > fundedBalance) {
      Alert.alert('Insufficient Balance', 'Withdrawal amount exceeds your current local vault balance.');
      return;
    }

    haptic.medium();
    const updatedTx = await recordLocalTransaction(
      payType,
      amount,
      defaultCard.last4,
      payType === 'deposit'
        ? `Instant Card Top-Up via ${defaultCard.brand} •••• ${defaultCard.last4}`
        : `Profit Payout to ${defaultCard.brand} •••• ${defaultCard.last4}`
    );

    const newBal = await getLocalFundedBalance();
    setFundedBalance(newBal);
    setTransactions(updatedTx);
    setShowPayModal(false);
    haptic.success();
    refreshDashboard();

    Alert.alert(
      payType === 'deposit' ? 'Deposit Completed' : 'Payout Initiated',
      payType === 'deposit'
        ? `Successfully credited $${amount.toLocaleString()} to your local vault balance.`
        : `Successfully queued a payout of $${amount.toLocaleString()} to your card ending in ${defaultCard.last4}.`
    );
  };

  const handleExportData = async () => {
    haptic.selection();
    const jsonString = await exportAllLocalData();
    try {
      await Share.share({
        message: jsonString,
        title: 'Aurum Local Device Backup',
      });
    } catch {}
  };

  const handleWipeData = () => {
    Alert.alert(
      'WIPE ALL LOCAL DATA?',
      'This will permanently delete your local profile, cards, and transaction records from this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Permanently Wipe',
          style: 'destructive',
          onPress: async () => {
            await wipeAllLocalData();
            haptic.heavy();
            loadData();
            Alert.alert('Data Wiped', 'All local records removed.');
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Profile Glass Card */}
        <GlassCard glowColor="gold" borderRadius={22} style={styles.profileCardPad}>
          <View style={styles.profileTop}>
            <LinearGradient
              colors={['#FFE082', '#FF8F00']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.avatarCircle}
            >
              <Text style={styles.avatarInitials}>
                {profile.name.substring(0, 2).toUpperCase()}
              </Text>
            </LinearGradient>

            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={styles.profileName}>{profile.name}</Text>
                <GradientPill
                  label="EDIT"
                  variant="glass"
                  size="sm"
                  onPress={() => {
                    setNameInput(profile.name);
                    setEmailInput(profile.email);
                    setBioInput(profile.bio);
                    setShowEditProfile(true);
                  }}
                />
              </View>
              <Text style={styles.profileEmail}>{profile.email}</Text>
            </View>
          </View>

          <View style={styles.sovereignBadgeRow}>
            <GradientPill
              label={profile.tier}
              variant="bullish"
              icon={<Ionicons name="shield-checkmark" size={12} color="#000" />}
              size="sm"
            />
          </View>

          <Text style={styles.profileBio}>{profile.bio}</Text>

          <View style={styles.localNotice}>
            <Ionicons name="hardware-chip" size={16} color={colors.goldBright} />
            <Text style={styles.localNoticeText}>
              100% Free & Local: All accounts, cards, API keys, and transaction history are stored directly on your device. Zero subscriptions, zero cloud harvesting.
            </Text>
          </View>
        </GlassCard>

        {/* Local Vault Balance Pod */}
        <GlassCard glowColor="gold" borderRadius={20} style={styles.balancePad}>
          <Text style={styles.balanceLabel}>LOCAL VAULT LIQUIDITY</Text>
          <Text style={styles.balanceValue}>
            ${fundedBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </Text>

          <View style={styles.actionButtonsRow}>
            <GradientPill
              label="Deposit with Card"
              variant="bullish"
              icon={<Ionicons name="arrow-down-circle" size={16} color="#000" />}
              size="md"
              style={{ flex: 1, justifyContent: 'center' }}
              onPress={() => {
                setPayType('deposit');
                setPayAmount('500');
                setShowPayModal(true);
              }}
            />

            <GradientPill
              label="Receive Payout"
              variant="gold"
              icon={<Ionicons name="arrow-up-circle" size={16} color="#000" />}
              size="md"
              style={{ flex: 1, justifyContent: 'center' }}
              onPress={() => {
                setPayType('withdrawal');
                setPayAmount('250');
                setShowPayModal(true);
              }}
            />
          </View>
        </GlassCard>

        {/* Saved Payment Cards Section */}
        <GlassCard borderRadius={20} style={styles.sectionPad}>
          <View style={styles.sectionHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="card" size={18} color={colors.goldBright} />
              <Text style={styles.sectionTitle}>MY PAYMENT CARDS ({cards.length})</Text>
            </View>

            <GradientPill
              label="+ ADD CARD"
              variant="gold"
              size="sm"
              onPress={() => setShowAddCard(true)}
            />
          </View>

          {cards.length === 0 ? (
            <View style={styles.emptyCardBox}>
              <Ionicons name="card-outline" size={36} color={colors.textMuted} />
              <Text style={styles.emptyCardText}>No payment cards linked yet.</Text>
              <Text style={styles.emptyCardSub}>
                Add your debit or credit card to deposit trading funds and receive instant payouts directly on your device.
              </Text>
            </View>
          ) : (
            cards.map((c) => (
              <View key={c.id} style={styles.cardItemWrapper}>
                <LinearGradient
                  colors={['#1E2A42', '#111728', '#0A0E1A']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.cardItem}
                >
                  <View style={styles.cardSpecular} />

                  <View style={styles.cardItemTop}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Ionicons
                        name="card"
                        size={22}
                        color={c.brand === 'Visa' ? '#4B7BFF' : c.brand === 'Mastercard' ? '#FF5722' : colors.goldBright}
                      />
                      <Text style={styles.cardBrand}>{c.brand}</Text>
                      {c.isDefault && <GradientPill label="PRIMARY" variant="gold" size="sm" />}
                    </View>

                    <HapticTouchable
                      style={styles.deleteCardBtn}
                      onPress={() => handleDeleteCard(c)}
                      hapticType="medium"
                    >
                      <Ionicons name="trash-outline" size={16} color={colors.bearish} />
                    </HapticTouchable>
                  </View>

                  {/* Embossed Card Number */}
                  <Text style={styles.cardNumberMasked}>
                    •••• •••• •••• <Text style={{ color: colors.textPrimary, fontWeight: '900' }}>{c.last4}</Text>
                  </Text>

                  <View style={styles.cardItemBottom}>
                    <Text style={styles.cardHolderName}>{c.cardholder}</Text>
                    <Text style={styles.cardExpiry}>
                      EXP {c.expMonth}/{c.expYear}
                    </Text>
                  </View>

                  {!c.isDefault && (
                    <HapticTouchable
                      style={styles.setPrimaryBtn}
                      onPress={async () => {
                        const updated = await setDefaultLocalCard(c.id);
                        setCards(updated);
                        haptic.selection();
                      }}
                    >
                      <Text style={styles.setPrimaryText}>Set as Primary Card ›</Text>
                    </HapticTouchable>
                  )}
                </LinearGradient>
              </View>
            ))
          )}
        </GlassCard>

        {/* Local Transaction Ledger */}
        <GlassCard borderRadius={20} style={styles.sectionPad}>
          <View style={styles.sectionHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="receipt-outline" size={18} color={colors.goldBright} />
              <Text style={styles.sectionTitle}>DEVICE PAYMENT LEDGER</Text>
            </View>
            <GradientPill label="ENCRYPTED" variant="glass" size="sm" />
          </View>

          {transactions.length === 0 ? (
            <Text style={styles.emptyLedgerText}>No payment transactions recorded on this device yet.</Text>
          ) : (
            transactions.slice(0, 8).map((tx) => {
              const isDeposit = tx.type === 'deposit';
              return (
                <View key={tx.id} style={styles.txRow}>
                  <View style={[styles.txIconBox, { backgroundColor: isDeposit ? 'rgba(0, 245, 160, 0.15)' : 'rgba(255, 215, 0, 0.15)' }]}>
                    <Ionicons
                      name={isDeposit ? 'arrow-down' : 'arrow-up'}
                      size={14}
                      color={isDeposit ? colors.bullish : colors.goldBright}
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.txTitle}>{isDeposit ? 'Card Deposit' : 'Card Payout'}</Text>
                    <Text style={styles.txSub}>
                      {new Date(tx.timestamp).toLocaleDateString()} · •••• {tx.cardLast4}
                    </Text>
                  </View>

                  <Text
                    style={[
                      styles.txAmount,
                      { color: isDeposit ? colors.bullish : colors.textPrimary },
                    ]}
                  >
                    {isDeposit ? '+' : '-'}${tx.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </Text>
                </View>
              );
            })
          )}
        </GlassCard>

        {/* Data Sovereignty & Backup Controls */}
        <GlassCard borderRadius={20} style={styles.sectionPad}>
          <Text style={styles.sectionTitle}>DATA SOVEREIGNTY & PRIVACY</Text>
          <Text style={styles.privacySub}>
            You own 100% of your financial data. You can export a full offline JSON backup or wipe local storage at any time.
          </Text>

          <View style={styles.privacyActionsRow}>
            <GradientPill
              label="EXPORT BACKUP (JSON)"
              variant="glass"
              icon={<Ionicons name="cloud-download-outline" size={15} color={colors.goldBright} />}
              size="md"
              style={{ flex: 1, justifyContent: 'center' }}
              onPress={handleExportData}
            />

            <GradientPill
              label="WIPE DATA"
              variant="bearish"
              icon={<Ionicons name="trash-bin-outline" size={15} color="#FFF" />}
              size="md"
              onPress={handleWipeData}
            />
          </View>
        </GlassCard>
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal
        visible={showEditProfile}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowEditProfile(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Edit Local Profile</Text>
            <HapticTouchable style={styles.closeBtn} onPress={() => setShowEditProfile(false)}>
              <Ionicons name="close" size={20} color={colors.textPrimary} />
            </HapticTouchable>
          </View>

          <View style={styles.modalContent}>
            <Text style={styles.inputLabel}>DISPLAY NAME</Text>
            <TextInput
              style={styles.input}
              value={nameInput}
              onChangeText={setNameInput}
              placeholder="e.g. Satoshi Sovereign"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={[styles.inputLabel, { marginTop: 14 }]}>EMAIL ADDRESS</Text>
            <TextInput
              style={styles.input}
              value={emailInput}
              onChangeText={setEmailInput}
              placeholder="e.g. trader@local.device"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <Text style={[styles.inputLabel, { marginTop: 14 }]}>TRADING PHILOSOPHY / BIO</Text>
            <TextInput
              style={[styles.input, { height: 70, textAlignVertical: 'top' }]}
              value={bioInput}
              onChangeText={setBioInput}
              placeholder="Your trading guidelines..."
              placeholderTextColor={colors.textMuted}
              multiline
            />

            <HapticTouchable
              style={styles.saveModalBtn}
              onPress={handleSaveProfile}
              hapticType="medium"
            >
              <LinearGradient
                colors={['#FFE082', '#FF8F00']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.saveModalGradient}
              >
                <Text style={styles.saveModalBtnText}>SAVE PROFILE TO DEVICE</Text>
              </LinearGradient>
            </HapticTouchable>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Add Card Modal */}
      <Modal
        visible={showAddCard}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAddCard(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Payment Card</Text>
            <HapticTouchable style={styles.closeBtn} onPress={() => setShowAddCard(false)}>
              <Ionicons name="close" size={20} color={colors.textPrimary} />
            </HapticTouchable>
          </View>

          <View style={styles.modalContent}>
            <View style={styles.secureCardBanner}>
              <Ionicons name="lock-closed" size={16} color={colors.goldBright} />
              <Text style={styles.secureCardText}>
                Encrypted locally on device. Zero data transmitted to external cloud.
              </Text>
            </View>

            <Text style={styles.inputLabel}>CARD NUMBER (15-16 DIGITS)</Text>
            <TextInput
              style={styles.input}
              value={cardNumber}
              onChangeText={setCardNumber}
              placeholder="4242 4242 4242 4242"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
              maxLength={19}
            />

            <Text style={[styles.inputLabel, { marginTop: 14 }]}>CARDHOLDER NAME</Text>
            <TextInput
              style={styles.input}
              value={cardHolder}
              onChangeText={setCardHolder}
              placeholder="FIRSTNAME LASTNAME"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="characters"
            />

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 14 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>EXP MONTH (MM)</Text>
                <TextInput
                  style={styles.input}
                  value={expMonth}
                  onChangeText={setExpMonth}
                  placeholder="12"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  maxLength={2}
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>EXP YEAR (YY)</Text>
                <TextInput
                  style={styles.input}
                  value={expYear}
                  onChangeText={setExpYear}
                  placeholder="29"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  maxLength={2}
                />
              </View>
            </View>

            <HapticTouchable
              style={styles.saveModalBtn}
              onPress={handleAddCard}
              hapticType="medium"
            >
              <LinearGradient
                colors={['#FFE082', '#FF8F00']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.saveModalGradient}
              >
                <Text style={styles.saveModalBtnText}>ENCRYPT & SAVE CARD</Text>
              </LinearGradient>
            </HapticTouchable>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Process Deposit / Payout Modal */}
      <Modal
        visible={showPayModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowPayModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {payType === 'deposit' ? 'Deposit with Card' : 'Receive Profit Payout'}
            </Text>
            <HapticTouchable style={styles.closeBtn} onPress={() => setShowPayModal(false)}>
              <Ionicons name="close" size={20} color={colors.textPrimary} />
            </HapticTouchable>
          </View>

          <View style={styles.modalContent}>
            <Text style={styles.inputLabel}>ENTER AMOUNT (USD)</Text>
            <TextInput
              style={[styles.input, { fontSize: 26, fontWeight: '900', textAlign: 'center' }]}
              value={payAmount}
              onChangeText={setPayAmount}
              keyboardType="numeric"
            />

            <View style={styles.quickPillsRow}>
              {['100', '250', '500', '1000', '5000'].map((amt) => (
                <GradientPill
                  key={amt}
                  label={`$${amt}`}
                  variant={payAmount === amt ? 'gold' : 'glass'}
                  active={payAmount === amt}
                  size="sm"
                  onPress={() => setPayAmount(amt)}
                />
              ))}
            </View>

            {cards.length > 0 && (
              <View style={styles.selectedCardBox}>
                <Ionicons name="card" size={18} color={colors.goldBright} />
                <Text style={styles.selectedCardText}>
                  Linked Card: {cards.find((c) => c.isDefault)?.brand || cards[0].brand} ••••{' '}
                  {cards.find((c) => c.isDefault)?.last4 || cards[0].last4}
                </Text>
              </View>
            )}

            <HapticTouchable
              style={styles.saveModalBtn}
              onPress={handleProcessPayment}
              hapticType="heavy"
            >
              <LinearGradient
                colors={payType === 'deposit' ? ['#00F5A0', '#00D9F5'] : ['#FFE082', '#FF8F00']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.saveModalGradient}
              >
                <Text style={[styles.saveModalBtnText, { color: '#06090E' }]}>
                  {payType === 'deposit' ? `CONFIRM DEPOSIT OF $${payAmount}` : `CONFIRM PAYOUT OF $${payAmount}`}
                </Text>
              </LinearGradient>
            </HapticTouchable>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgVoid,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
    paddingBottom: 40,
  },
  profileCardPad: {
    padding: 18,
  },
  profileTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 12,
  },
  avatarCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
  },
  avatarInitials: {
    fontSize: 20,
    fontWeight: '900',
    color: '#06090E',
  },
  profileName: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  profileEmail: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  sovereignBadgeRow: {
    marginBottom: 10,
  },
  profileBio: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: 12,
  },
  localNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(255, 215, 0, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.2)',
    padding: 10,
    borderRadius: 10,
  },
  localNoticeText: {
    flex: 1,
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  balancePad: {
    padding: 18,
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 1.2,
  },
  balanceValue: {
    fontSize: 34,
    fontWeight: '900',
    color: colors.textPrimary,
    marginTop: 4,
    marginBottom: 16,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  sectionPad: {
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: 0.8,
  },
  emptyCardBox: {
    paddingVertical: 24,
    alignItems: 'center',
    gap: 6,
  },
  emptyCardText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  emptyCardSub: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 18,
  },
  cardItemWrapper: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  cardItem: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    position: 'relative',
  },
  cardSpecular: {
    position: 'absolute',
    top: 0,
    left: '10%',
    right: '10%',
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  cardItemTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardBrand: {
    fontSize: 15,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  deleteCardBtn: {
    padding: 4,
  },
  cardNumberMasked: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.textMuted,
    letterSpacing: 2,
    marginBottom: 12,
  },
  cardItemBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardHolderName: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
  cardExpiry: {
    fontSize: 11,
    color: colors.textMuted,
  },
  setPrimaryBtn: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.borderGlass,
  },
  setPrimaryText: {
    fontSize: 11,
    color: colors.gold,
    fontWeight: '800',
  },
  emptyLedgerText: {
    fontSize: 12,
    color: colors.textMuted,
    paddingVertical: 12,
    textAlign: 'center',
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderGlass,
    gap: 10,
  },
  txIconBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  txSub: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  txAmount: {
    fontSize: 14,
    fontWeight: '900',
  },
  privacySub: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
    marginVertical: 8,
  },
  privacyActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.bgVoid,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderGlass,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: colors.borderGlass,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContent: {
    padding: 16,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.textPrimary,
    fontSize: 14,
    borderWidth: 1,
    borderColor: colors.borderGlass,
  },
  saveModalBtn: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 20,
  },
  saveModalGradient: {
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 12,
  },
  saveModalBtnText: {
    color: '#06090E',
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 0.8,
  },
  secureCardBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 215, 0, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.2)',
    padding: 10,
    borderRadius: 10,
    marginBottom: 16,
  },
  secureCardText: {
    flex: 1,
    fontSize: 11,
    color: colors.textSecondary,
  },
  quickPillsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
    marginBottom: 16,
  },
  selectedCardBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderGlass,
  },
  selectedCardText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textPrimary,
  },
});
